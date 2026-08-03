const KEY = 'sokoban.progress';

/**
 * Progress is stored as JSON in localStorage.
 *
 * storage is injected so tests can plug in a fake localStorage — this module is the
 * only place in the game that touches localStorage.
 */
export class ProgressStore {
  #storage;
  #root = null;

  constructor(storage = globalThis.localStorage) {
    this.#storage = storage;
  }

  get #data() {
    if (this.#root) return this.#root;

    this.#root = { musicOn: true, sfxOn: true, collections: [] };

    // getItem sits INSIDE the try: some browsers' private mode throws on the read
    // itself, and letting that escape kills the game at load time.
    try {
      const raw = this.#storage.getItem(KEY);
      if (!raw) return this.#root;

      const parsed = JSON.parse(raw);
      this.#root = {
        ...readSound(parsed),
        // Filter junk once at the door: JSON that parses but has the wrong shape
        // (arrays holding null, strings, numbers) must still yield usable progress
        // rather than throwing and killing the game at load.
        collections: Array.isArray(parsed?.collections)
          ? parsed.collections
              .filter((c) => c && typeof c === 'object')
              .map((c) => ({
                ...c,
                levels: Array.isArray(c.levels)
                  ? c.levels.filter((l) => l && typeof l === 'object')
                  : [],
              }))
          : [],
      };
    } catch (error) {
      // Corrupt or blocked: start over — never throw and kill the game.
      console.warn(`ProgressStore: could not read progress, starting fresh (${error.message})`);
      this.#root = { musicOn: true, sfxOn: true, collections: [] };
    }

    return this.#root;
  }

  #save() {
    try {
      this.#storage.setItem(KEY, JSON.stringify(this.#data));
    } catch (error) {
      // Private mode or out of space: play carries on, it just remembers nothing.
      console.warn(`ProgressStore: could not save progress (${error.message})`);
    }
  }

  #collection(name) {
    let found = this.#data.collections.find((c) => c.name === name);
    if (!found) {
      found = { name, lastPlayedIndex: 0, levels: [] };
      this.#data.collections.push(found);
    }
    if (!Array.isArray(found.levels)) found.levels = [];
    return found;
  }

  getRecord(collection, index) {
    const coll = this.#collection(collection);
    let record = coll.levels.find((l) => l.index === index);
    if (!record) {
      record = { index, completed: false, bestMoves: 0, bestPushes: 0 };
      coll.levels.push(record);
    }
    return record;
  }

  recordCompletion(collection, index, moves, pushes) {
    const record = this.getRecord(collection, index);

    if (!record.completed) {
      record.completed = true;
      record.bestMoves = moves;
      record.bestPushes = pushes;
    } else {
      if (moves < record.bestMoves) record.bestMoves = moves;
      if (pushes < record.bestPushes) record.bestPushes = pushes;
    }

    this.#save();
  }

  /** Sequential unlocking: level 0 is always open, level n opens once n-1 is done. */
  isUnlocked(collection, index) {
    if (index <= 0) return true;
    return this.getRecord(collection, index - 1).completed;
  }

  getLastPlayedIndex(collection) {
    return this.#collection(collection).lastPlayedIndex ?? 0;
  }

  setLastPlayedIndex(collection, index) {
    this.#collection(collection).lastPlayedIndex = index;
    this.#save();
  }

  get musicOn() { return this.#data.musicOn; }

  set musicOn(value) {
    this.#data.musicOn = Boolean(value);
    this.#save();
  }

  get sfxOn() { return this.#data.sfxOn; }

  set sfxOn(value) {
    this.#data.sfxOn = Boolean(value);
    this.#save();
  }

  clear() {
    // Set null rather than an empty object: the next read must go through the
    // read-and-catch branch, or the corrupt-JSON test passes for the wrong reason.
    this.#root = null;
    try {
      this.#storage.removeItem(KEY);
    } catch (error) {
      console.warn(`ProgressStore: could not clear progress (${error.message})`);
    }
  }
}

/**
 * Reads the two sound switches, migrating saves written before they were split.
 *
 * Those saves have a single `muted` flag. `muted: true` silenced the lot, so it becomes
 * both switches off. The old field is read but never written back — one save format is
 * enough to reason about.
 */
function readSound(parsed) {
  if (typeof parsed?.musicOn === 'boolean' || typeof parsed?.sfxOn === 'boolean') {
    return { musicOn: parsed.musicOn !== false, sfxOn: parsed.sfxOn !== false };
  }

  const on = !parsed?.muted;
  return { musicOn: on, sfxOn: on };
}
