/** The overlay shown after a level is solved. */
export class LevelComplete {
  #root;
  #stats;
  #best;
  #nextBtn;

  constructor(rootEl, { onNext, onRetry, onSelect }) {
    this.#root = rootEl;
    this.#stats = rootEl.querySelector('#complete-stats');
    this.#best = rootEl.querySelector('#complete-best');
    this.#nextBtn = rootEl.querySelector('#btn-next');

    this.#nextBtn.addEventListener('click', onNext);
    rootEl.querySelector('#btn-retry').addEventListener('click', onRetry);
    rootEl.querySelector('#btn-to-levels').addEventListener('click', onSelect);
  }

  show({ moves, pushes, bestMoves, hasNext }) {
    this.#stats.textContent = `${moves} moves · ${pushes} pushes`;
    this.#best.textContent = bestMoves > 0 && bestMoves <= moves
      ? `Your best: ${bestMoves} moves`
      : 'New best!';

    // The last level of the set has nothing to move on to.
    this.#nextBtn.hidden = !hasNext;
    if (!hasNext) this.#stats.textContent += ' — that was the last level, congratulations!';

    this.#root.hidden = false;
  }

  hide() {
    this.#root.hidden = true;
  }
}
