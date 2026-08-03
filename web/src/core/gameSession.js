import { Board } from './board.js';
import { MoveHistory } from './moveHistory.js';
import { resolve, apply, revert } from './moveResolver.js';

/** Bundles board + history + counters for one play-through of one level. */
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
  get levelName() { return this.#level.name; }

  /** Returns an unsubscribe function, so callers need not keep the listener reference. */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    for (const listener of this.#listeners) listener();
  }

  /** Returns the move that ran, or null if it was blocked. */
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

  restart() {
    this.board = Board.fromLevel(this.#level);
    this.#history.clear();
    this.moves = 0;
    this.pushes = 0;
    this.#emit();
  }
}
