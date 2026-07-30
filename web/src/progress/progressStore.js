const KEY = 'sokoban.progress';

/**
 * Tiến độ lưu dạng JSON trong localStorage. Giữ nguyên hình dạng của bản Unity
 * để sau này còn đối chiếu được.
 *
 * storage nhận từ ngoài vào để test cắm được localStorage giả — module này là
 * chỗ duy nhất trong game đụng tới localStorage.
 */
export class ProgressStore {
  #storage;
  #root = null;

  constructor(storage = globalThis.localStorage) {
    this.#storage = storage;
  }

  get #data() {
    if (this.#root) return this.#root;

    const raw = this.#storage.getItem(KEY);
    if (!raw) {
      this.#root = { muted: false, collections: [] };
      return this.#root;
    }

    try {
      const parsed = JSON.parse(raw);
      this.#root = {
        muted: Boolean(parsed?.muted),
        collections: Array.isArray(parsed?.collections) ? parsed.collections : [],
      };
    } catch (error) {
      // Hỏng thì bắt đầu lại — không được ném lỗi làm chết game.
      console.warn(`ProgressStore: tiến độ hỏng, đặt lại từ đầu (${error.message})`);
      this.#root = { muted: false, collections: [] };
    }
    return this.#root;
  }

  #save() {
    try {
      this.#storage.setItem(KEY, JSON.stringify(this.#data));
    } catch (error) {
      // Chế độ riêng tư hoặc hết chỗ: chơi tiếp được, chỉ là không nhớ gì.
      console.warn(`ProgressStore: không lưu được tiến độ (${error.message})`);
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

  /** Mở khoá tuần tự: màn 0 luôn mở, màn n mở khi màn n-1 đã xong. */
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

  get muted() { return this.#data.muted; }

  set muted(value) {
    this.#data.muted = Boolean(value);
    this.#save();
  }

  clear() {
    // Đặt null chứ không phải object rỗng: lần đọc sau phải đi qua nhánh
    // đọc-và-bắt-lỗi, nếu không test JSON hỏng sẽ xanh vì lý do sai.
    this.#root = null;
    this.#storage.removeItem(KEY);
  }
}
