import { Board } from './board.js';
import { MoveHistory } from './moveHistory.js';
import { resolve, apply, revert } from './moveResolver.js';

/** Gói board + lịch sử + bộ đếm cho một lượt chơi một màn. */
export class GameSession {
  #level;
  #history = new MoveHistory();
  #listeners = new Set();

  constructor(level) {
    this.#level = level;
    this.board = Board.fromLevel(level);
    this.moves = 0;
    this.pushes = 0;
  }

  get isSolved() { return this.board.isSolved; }
  get canUndo() { return this.#history.canUndo; }
  get canRedo() { return this.#history.canRedo; }
  get levelName() { return this.#level.name; }

  /** Trả về hàm huỷ đăng ký, để nơi gọi không phải giữ tham chiếu tới listener. */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    for (const listener of this.#listeners) listener();
  }

  /** Trả về nước đi đã chạy, hoặc null nếu bị chặn. */
  tryMove(dir) {
    const move = resolve(this.board, dir);
    if (move.blocked) return null;

    apply(this.board, move);
    this.#history.record(move);
    this.moves++;
    if (move.push) this.pushes++;

    this.#emit();
    return move;
  }

  tryUndo() {
    if (!this.#history.canUndo) return null;

    const move = this.#history.popForUndo();
    revert(this.board, move);
    this.moves--;
    if (move.push) this.pushes--;

    this.#emit();
    return move;
  }

  tryRedo() {
    if (!this.#history.canRedo) return null;

    const move = this.#history.popForRedo();
    apply(this.board, move);
    this.moves++;
    if (move.push) this.pushes++;

    this.#emit();
    return move;
  }

  restart() {
    this.board = Board.fromLevel(this.#level);
    this.#history.clear();
    this.moves = 0;
    this.pushes = 0;
    this.#emit();
  }
}
