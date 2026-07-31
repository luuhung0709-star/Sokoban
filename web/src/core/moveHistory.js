/** Two stacks: moves played and the undone branch. A new move clears the redo branch. */
export class MoveHistory {
  #done = [];
  #undone = [];

  get canUndo() { return this.#done.length > 0; }
  get canRedo() { return this.#undone.length > 0; }

  record(move) {
    this.#done.push(move);
    this.#undone.length = 0;
  }

  popForUndo() {
    const move = this.#done.pop();
    this.#undone.push(move);
    return move;
  }

  popForRedo() {
    const move = this.#undone.pop();
    this.#done.push(move);
    return move;
  }

  clear() {
    this.#done.length = 0;
    this.#undone.length = 0;
  }
}
