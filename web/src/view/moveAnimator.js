const FALLBACK_MS = 400;

/**
 * Animates one move by changing the transform and waiting for transitionend. There is
 * a fallback timeout because transitionend never fires when the tab is hidden or when
 * the transform value does not actually change — without it, this hangs forever.
 */
export class MoveAnimator {
  #renderer;
  #root;
  #busy = false;
  #generation = 0;

  constructor(renderer, rootEl) {
    this.#renderer = renderer;
    this.#root = rootEl;
  }

  get isBusy() { return this.#busy; }

  async play(move, { reverse = false } = {}) {
    const generation = this.#generation;
    this.#busy = true;
    try {
      const playerTo = reverse ? move.from : move.to;

      if (move.push) {
        const boxFrom = reverse ? move.boxTo : move.boxFrom;
        const boxTo = reverse ? move.boxFrom : move.boxTo;
        const boxEl = this.#renderer.boxElAt(boxFrom.x, boxFrom.y);
        if (boxEl) {
          this.#renderer.rekeyBox(boxFrom.x, boxFrom.y, boxTo.x, boxTo.y);
          this.#renderer.placeActor(boxEl, boxTo.x, boxTo.y);
        }
      }

      this.#renderer.placeActor(this.#renderer.playerEl, playerTo.x, playerTo.y);
      await this.#waitForEnd(this.#renderer.playerEl);
    } finally {
      // Only release the busy flag if the board was not rebuilt meanwhile — an
      // animation from the old level must not release the new level's flag.
      if (generation === this.#generation) this.#busy = false;
    }
  }

  /**
   * Snaps every actor onto its square with no animation — used on level load and
   * restart. `after` runs WHILE transitions are still off: resizing the cell changes
   * every actor's transform, and doing it outside this window makes them slide.
   */
  snap(board, after) {
    // Rebuilding the board makes any in-flight animation meaningless: bump the
    // generation and drop the busy flag, or the new play-through buffers its first
    // command somewhere nobody collects it.
    this.#generation++;
    this.#busy = false;

    this.#root.classList.add('board--no-anim');
    this.#renderer.build(board);
    after?.();
    // Force the browser to recompute layout before dropping the class, or the
    // transition catches this transform change and the actors fly anyway.
    void this.#root.offsetHeight;
    this.#root.classList.remove('board--no-anim');
  }

  #waitForEnd(el) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener('transitionend', finish);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, FALLBACK_MS);
      el.addEventListener('transitionend', finish);
    });
  }
}
