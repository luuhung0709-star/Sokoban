/** Overlay hiện sau khi giải xong một màn. */
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
    this.#stats.textContent = `${moves} bước · ${pushes} lần đẩy`;
    this.#best.textContent = bestMoves > 0 && bestMoves <= moves
      ? `Kỷ lục của bạn: ${bestMoves} bước`
      : 'Kỷ lục mới!';

    // Màn cuối bộ thì không có gì để đi tiếp.
    this.#nextBtn.hidden = !hasNext;
    if (!hasNext) this.#stats.textContent += ' — hết bộ màn, chúc mừng!';

    this.#root.hidden = false;
  }

  hide() {
    this.#root.hidden = true;
  }
}
