const FALLBACK_MS = 400;

/**
 * Chạy animation cho một nước đi bằng cách đổi transform rồi đợi transitionend.
 * Có timeout dự phòng vì transitionend không nổ khi tab bị ẩn hoặc khi giá trị
 * transform không thực sự đổi — thiếu nó là kẹt vĩnh viễn.
 */
export class MoveAnimator {
  #renderer;
  #root;
  #busy = false;

  constructor(renderer, rootEl) {
    this.#renderer = renderer;
    this.#root = rootEl;
  }

  get isBusy() { return this.#busy; }

  async play(move, { reverse = false } = {}) {
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
      this.#busy = false;
    }
  }

  /** Đặt lại mọi actor về đúng ô, không animation — dùng khi load màn và restart. */
  snap(board) {
    this.#root.classList.add('board--no-anim');
    this.#renderer.build(board);
    // Ép trình duyệt tính lại layout trước khi bỏ class, nếu không transition
    // sẽ bắt được lần đổi transform này và actor vẫn bay.
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
