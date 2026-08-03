import { boxKey, CellType } from '../core/board.js';
import { toDelta } from '../core/direction.js';
import { commandToDirection, Command } from '../input/inputRouter.js';

/**
 * The play loop for one level: take a command, call the session, run the animation.
 * While an animation runs it buffers at most 1 command — buffer more and the player
 * keeps walking several steps after the key is released.
 */
export class LevelPlayer {
  #session;
  #renderer;
  #animator;
  #router;
  #hooks;
  #buffered = null;
  #stopped = false;
  #looping = false;
  #wake = null;         // wakes the loop while it waits out the key-repeat delay
  #hintService;
  #hintBusy = false;
  #commandSeq = 0;       // bumped once per command in #runOne; stands in for board identity

  constructor({ session, renderer, animator, router, hintService = null, hooks = {} }) {
    this.#session = session;
    this.#renderer = renderer;
    this.#animator = animator;
    this.#router = router;
    this.#hintService = hintService;
    this.#hooks = hooks;
  }

  start() {
    this.#renderer.clearHint();
    this.#animator.snap(this.#session.board, () => {
      this.#renderer.fitCellSize(this.#session.board);
    });
    // A level can start with the player already braced against a box.
    this.#syncPushPose();
  }

  /**
   * Cuts this play-through short. GameFlow calls it when leaving a level: an
   * in-flight animation still holds references to the old session and renderer, and
   * left running it would carry on and draw over the level just opened.
   */
  stop() {
    this.#stopped = true;
    this.#buffered = null;
    this.#renderer.clearHint();
    this.#wake?.();     // if asleep on the repeat delay, wake now to exit the loop
  }

  handle(command) {
    if (this.#stopped) return;

    if (command === Command.Exit) {
      this.#hooks.onExit?.();
      return;
    }

    // Hint is answered here, OUTSIDE the play loop and before the busy check. Letting it
    // into the loop would queue it behind a move, so the highlight would appear one step
    // too late — and it has no animation to sequence with in the first place.
    if (command === Command.Hint) {
      // Same defensive .catch as the play loop below: onHintStart/onHintDone/showHint run
      // outside the try/catch inside #showHint, so a throw from any of them would
      // otherwise be an unhandled rejection with nothing to trace it back to.
      this.#showHint().catch((error) => console.error('LevelPlayer: hint failed', error));
      return;
    }

    // Once solved, block every play command: the overlay covers the board, so
    // changing the board behind it is pointless. Retrying or switching levels goes
    // through the overlay's buttons — those run via GameFlow, which rebuilds properly.
    if (this.#session.isSolved) return;

    // This must also block while the loop waits out the key-repeat delay: the
    // animation has finished by then so `isBusy` is off, and relying on it alone lets
    // a new key press start a second loop in parallel, doubling every move.
    if (this.#animator.isBusy || this.#looping) {
      this.#buffered = command;
      // The loop may be asleep on the key-repeat delay. Wake it now, or a key pressed
      // mid-wait only lands once the delay expires — fast typing would feel laggy.
      this.#wake?.();
      return;
    }
    this.#loop(command).catch((error) => console.error('LevelPlayer: play loop failed', error));
  }

  /**
   * Asks the solver about the position on screen right now.
   *
   * The answer can take seconds, so everything is re-checked when it lands: the player
   * may have moved on, restarted, or left the level entirely, and a hint drawn onto a
   * board that has changed points at the wrong square. Staleness is judged by
   * `#commandSeq`, not `session.moves` — `moves` resets to 0 on restart, so two
   * genuinely different boards can otherwise share the same count and look unchanged.
   */
  async #showHint() {
    if (!this.#hintService || this.#hintBusy || this.#session.isSolved) return;

    const askedAt = this.#commandSeq;
    this.#hintBusy = true;
    this.#hooks.onHintStart?.();

    let hint = null;
    try {
      hint = await this.#hintService.requestHint(this.#session.board);
    } catch (error) {
      // requestHint is built never to reject, but a slip here must still reach the
      // finally below — otherwise #hintBusy would stay stuck true and the button would
      // never leave its "Thinking…" state.
      console.error('LevelPlayer: asking for a hint failed', error);
    } finally {
      this.#hintBusy = false;
    }

    // A stopped player's hud has already moved on: GameFlow rebinds it to the next
    // level's session before or shortly after calling stop(), so calling the hooks
    // here would stomp on state that bind() has since reset, not merely repeat news
    // nobody is around to read.
    if (this.#stopped) return;

    const stale = this.#commandSeq !== askedAt;
    // `found` is forced true when stale: the button must come out of its thinking state
    // either way, but a board nobody is looking at any more has no bad news to report.
    this.#hooks.onHintDone?.(stale || Boolean(hint));
    if (stale || !hint) return;

    this.#renderer.showHint(hint.box, hint.dir);
  }

  /**
   * A loop rather than recursion: hold a key for a minute and the recursive version
   * stacks one more frame per step and never unwinds.
   */
  async #loop(first) {
    let command = first;
    this.#looping = true;
    try {
      while (command && !this.#stopped) {
        const acted = await this.#runOne(command);
        if (this.#stopped) return;

        const next = await this.#nextCommand(acted);
        command = this.#session.isSolved ? null : next;
      }
    } finally {
      this.#looping = false;
    }
  }

  /**
   * The next command: a buffered one wins, and only then the held key — and a held
   * key still has to clear the repeat delay before it counts.
   *
   * It waits out the delay and re-reads rather than returning `null` straight away:
   * `null` exits the loop entirely, forcing the player to release and press again.
   */
  async #nextCommand(acted) {
    const buffered = this.#takeBuffered();
    if (buffered) return buffered;

    // A blocked move does NOT auto-continue from the held key. The player is pushing
    // into a wall, and #runOne awaits nothing in that case — repeating would spin a
    // tight loop and freeze the tab.
    if (!acted) return null;

    const wait = this.#router.msUntilRepeat;
    if (wait == null) return null;              // no direction key held
    if (wait > 0) await this.#sleep(wait);
    if (this.#stopped) return null;

    // During the wait the player may have released the key or pressed another.
    return this.#takeBuffered() ?? this.#router.heldDirection;
  }

  #takeBuffered() {
    const command = this.#buffered;
    this.#buffered = null;
    return command;
  }

  /** Sleeps `ms`, but wakes early on a new command or when the play-through stops. */
  #sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.#wake = null;
        resolve();
      }, ms);
      this.#wake = () => {
        clearTimeout(timer);
        this.#wake = null;
        resolve();
      };
    });
  }

  /** Returns true if something actually ran (and its animation has been awaited). */
  async #runOne(command) {
    // Any command at all invalidates the hint on screen — including a blocked move,
    // where the player has at least turned and the arrow no longer reads right. Bump
    // the sequence number for the same reason: it is what #showHint checks to tell an
    // answered-but-outdated search apart from one still worth drawing.
    this.#renderer.clearHint();
    this.#commandSeq++;

    const acted = await this.#dispatch(command);
    // Sync the pose in EXACTLY ONE place, after every command — including blocked
    // moves, because the player still turns that way and may have just turned into a
    // box. Scattering this call across the move/undo/restart branches would
    // sooner or later miss one.
    if (!this.#stopped) this.#syncPushPose();
    return acted;
  }

  /** Switch to the push pose when the player is braced against a box. */
  #syncPushPose() {
    const board = this.#session.board;
    const { dx, dy } = toDelta(this.#renderer.playerFacing);
    this.#renderer.setPlayerPushing(
      board.boxes.has(boxKey(board.player.x + dx, board.player.y + dy)),
    );
  }

  async #dispatch(command) {
    if (this.#stopped) return false;

    const dir = commandToDirection(command);

    if (dir) return this.#step(dir);
    if (command === Command.Undo) return this.#stepHistory(this.#session.tryUndo());
    if (command === Command.Restart) {
      this.#restart();
      return true;
    }
    return false;
  }

  async #step(dir) {
    this.#renderer.setPlayerFacing(dir);
    const move = this.#session.tryMove(dir);
    if (!move) return false;

    this.#hooks.onSound?.(move.push ? 'push' : 'step');
    await this.#animator.play(move);
    // Leaving the level mid-animation stops right here: #afterMove would call
    // onSolved on a discarded session, and the level just solved would never be
    // recorded as complete.
    if (this.#stopped) return false;

    this.#afterMove(move);
    return true;
  }

  async #stepHistory(move) {
    if (!move) return false;

    this.#hooks.onSound?.('undo');
    await this.#animator.play(move, { reverse: true });
    // The renderer may have been rebuilt for a different level during the wait.
    if (this.#stopped) return false;

    this.#renderer.refreshBoxLook(this.#session.board);
    return true;
  }

  #restart() {
    this.#session.restart();
    this.#animator.snap(this.#session.board, () => {
      this.#renderer.fitCellSize(this.#session.board);
    });
  }

  /** Change the mark on a box at the END of the animation, not at its start. */
  #afterMove(move) {
    this.#renderer.refreshBoxLook(this.#session.board);

    const landedOnGoal = move.push
      && this.#session.board.cellAt(move.boxTo.x, move.boxTo.y) === CellType.Goal;
    if (landedOnGoal) this.#hooks.onSound?.('boxOnGoal');

    if (this.#session.isSolved) {
      this.#hooks.onSound?.('win');
      this.#hooks.onSolved?.();
    }
  }
}
