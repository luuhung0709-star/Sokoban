import { Command } from '../input/inputRouter.js';

/** Thanh thông tin trên và hàng nút dưới. Bám theo session qua onChange. */
export class Hud {
  #name;
  #moves;
  #pushes;
  #undo;
  #redo;

  constructor(rootEl, router) {
    this.#name = rootEl.querySelector('#hud-name');
    this.#moves = rootEl.querySelector('#hud-moves');
    this.#pushes = rootEl.querySelector('#hud-pushes');
    this.#undo = rootEl.querySelector('#btn-undo');
    this.#redo = rootEl.querySelector('#btn-redo');

    router.bindButton(this.#undo, Command.Undo);
    router.bindButton(this.#redo, Command.Redo);
    router.bindButton(rootEl.querySelector('#btn-restart'), Command.Restart);
    router.bindButton(rootEl.querySelector('#btn-exit'), Command.Exit);
  }

  setLevelLabel(text) {
    this.#name.textContent = text;
  }

  /** Trả về hàm gỡ, để đổi màn không để lại listener bám vào session cũ. */
  bind(session) {
    const refresh = () => {
      this.#moves.textContent = String(session.moves);
      this.#pushes.textContent = String(session.pushes);
      this.#undo.disabled = !session.canUndo;
      this.#redo.disabled = !session.canRedo;
    };

    refresh();
    return session.onChange(refresh);
  }
}
