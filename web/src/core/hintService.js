import { solveNextPush } from './solver.js';

/**
 * The budget used when the search has to run on the page itself. Much smaller than the
 * worker's, because every millisecond of it is a millisecond the tab is frozen.
 */
const MAIN_THREAD_BUDGET = { maxNodes: 20_000, maxMs: 1_500 };

const defaultCreateWorker = () =>
  new Worker(new URL('./solverWorker.js', import.meta.url), { type: 'module' });

/**
 * Asks the solver for the next push, off the main thread.
 *
 * `createWorker` is injected so tests can hand in a fake — there is no Worker in
 * `node --test`, and the real one would need a build step to be reachable from there.
 */
export class HintService {
  #createWorker;
  #solve;
  #worker = null;
  #brokenWorker = false;
  #nextId = 1;
  #pending = null;      // { id, resolve }

  constructor({ createWorker = defaultCreateWorker, solve = solveNextPush } = {}) {
    this.#createWorker = createWorker;
    this.#solve = solve;
  }

  /** Resolves with the push to make, or null — never rejects. The caller has no repair to do. */
  requestHint(board) {
    // Only one search at a time. Whoever asked first is no longer looking at the board
    // they asked about, so answer them null rather than leaving the promise hanging.
    this.#settle(null);

    try {
      const snapshot = snapshotOf(board);
      const worker = this.#ensureWorker();

      if (!worker) return Promise.resolve(this.#solve(snapshot, MAIN_THREAD_BUDGET));

      const id = this.#nextId++;
      return new Promise((resolve) => {
        this.#pending = { id, resolve };
        try {
          worker.postMessage({ id, snapshot });
        } catch (error) {
          // e.g. a DataCloneError from a malformed snapshot. A throw inside a Promise
          // executor auto-rejects it, which would break the "never rejects" contract
          // just as surely as a throw escaping this method outright.
          console.error(`HintService: could not hand the board to the worker (${error.message})`);
          this.#pending = null;
          resolve(null);
        }
      });
    } catch (error) {
      // Guards snapshotOf and the synchronous main-thread solve. Without this, a caller
      // doing `void hintService.requestHint(board)` would crash on the spot rather than
      // merely receiving no hint.
      console.error(`HintService: could not compute a hint (${error.message})`);
      return Promise.resolve(null);
    }
  }

  dispose() {
    this.#settle(null);
    this.#worker?.terminate();
    this.#worker = null;
  }

  /**
   * Returns null when this browser cannot give us a worker. Two ways that happens: the
   * constructor throws outright (a sandboxed page refusing Worker entirely), or the
   * worker starts but then fails to load — Firefox had no module workers before 114, so
   * it fetches solverWorker.js as a classic script, hits the `import` statement as a
   * parse error, and reports that asynchronously via `error`, never by throwing here.
   * Same for a CSP `worker-src` rejection or a 404 on the script. The hint still works
   * from the main thread either way; it just thinks for less time. Same choice
   * BoardRenderer makes for missing sprites and ProgressStore for a blocked
   * localStorage: degrade, never die.
   */
  #ensureWorker() {
    if (this.#worker || this.#brokenWorker) return this.#worker;

    try {
      this.#worker = this.#createWorker();
      this.#worker.onmessage = ({ data }) => this.#onMessage(data);
      this.#worker.onerror = (event) => {
        console.warn(`HintService: the worker failed, solving on the page from now on (${event.message ?? 'unknown error'})`);
        event.preventDefault?.();
        this.#brokenWorker = true;
        this.#worker?.terminate();
        this.#worker = null;
        this.#settle(null);
      };
      this.#worker.onmessageerror = this.#worker.onerror;
    } catch (error) {
      console.warn(`HintService: no worker available, solving on the page (${error.message})`);
      this.#brokenWorker = true;
      this.#worker = null;
    }

    return this.#worker;
  }

  #onMessage(data) {
    // Guard against a malformed message: throwing here would leave #pending set and the
    // promise hanging forever, which is worse than the null we would otherwise resolve.
    const { id, hint, error } = data ?? {};

    // A reply to a request that has already been superseded. Dropping it matters: it
    // describes a board the player has since changed.
    if (this.#pending?.id !== id) return;

    if (error) console.error(`HintService: the solver failed (${error})`);
    this.#settle(error ? null : hint ?? null);
  }

  #settle(value) {
    const pending = this.#pending;
    this.#pending = null;
    pending?.resolve(value);
  }
}

/**
 * A Board flattened to data `structuredClone` can carry: its methods would be lost
 * crossing into the worker, and `boxes` is a Set of "x,y" strings that the solver would
 * rather have as coordinates anyway.
 */
function snapshotOf(board) {
  return {
    width: board.width,
    height: board.height,
    statics: board.statics.map((row) => [...row]),
    boxes: [...board.boxes].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }),
    player: { ...board.player },
  };
}
