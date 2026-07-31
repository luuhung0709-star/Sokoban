import { Command } from '../input/inputRouter.js';

/** Thanh thông tin trên và hàng nút dưới. Bám theo session qua onChange. */
export class Hud {
  #name;
  #moves;
  #pushes;
  #undo;
  #redo;
  #restartBtn;

  constructor(rootEl, router) {
    this.#name = rootEl.querySelector('#hud-name');
    this.#moves = rootEl.querySelector('#hud-moves');
    this.#pushes = rootEl.querySelector('#hud-pushes');
    this.#undo = rootEl.querySelector('#btn-undo');
    this.#redo = rootEl.querySelector('#btn-redo');
    this.#restartBtn = rootEl.querySelector('#btn-restart');

    router.bindButton(this.#undo, Command.Undo);
    router.bindButton(this.#redo, Command.Redo);
    router.bindButton(this.#restartBtn, Command.Restart);
    router.bindButton(rootEl.querySelector('#btn-exit'), Command.Exit);
  }

  setLevelLabel(text) {
    this.#name.textContent = text;
  }

  /** Trả về hàm gỡ, để đổi màn không để lại listener bám vào session cũ. */
  bind(session) {
    const refresh = () => {
      // Thắng rồi thì ba nút này không còn tác dụng — phải xám đi, không thì
      // chúng trông vẫn bấm được mà bấm không ra gì.
      const solved = session.isSolved;
      this.#moves.textContent = String(session.moves);
      this.#pushes.textContent = String(session.pushes);
      this.#undo.disabled = solved || !session.canUndo;
      this.#redo.disabled = solved || !session.canRedo;
      this.#restartBtn.disabled = solved;
    };

    refresh();
    return session.onChange(refresh);
  }
}
