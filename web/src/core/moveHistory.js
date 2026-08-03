/** The stack of moves played, newest last. Undo pops; there is no redo. */
export class MoveHistory {
  #done = [];

  get canUndo() { return this.#done.length > 0; }

  record(move) {
    this.#done.push(move);
  }

  popForUndo() {
    return this.#done.pop();
  }

  clear() {
    this.#done.length = 0;
  }
}
