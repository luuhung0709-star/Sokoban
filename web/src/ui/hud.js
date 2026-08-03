import { Command } from '../input/inputRouter.js';

/** The info bar on top and the button row below. Follows the session via onChange. */
export class Hud {
  #name;
  #moves;
  #pushes;
  #undo;
  #restartBtn;

  constructor(rootEl, router) {
    this.#name = rootEl.querySelector('#hud-name');
    this.#moves = rootEl.querySelector('#hud-moves');
    this.#pushes = rootEl.querySelector('#hud-pushes');
    this.#undo = rootEl.querySelector('#btn-undo');
    this.#restartBtn = rootEl.querySelector('#btn-restart');

    router.bindButton(this.#undo, Command.Undo);
    router.bindButton(this.#restartBtn, Command.Restart);
    router.bindButton(rootEl.querySelector('#btn-exit'), Command.Exit);
  }

  setLevelLabel(text) {
    this.#name.textContent = text;
  }

  /** Returns an unbind function, so changing level leaves no listener on the old session. */
  bind(session) {
    const refresh = () => {
      // Once solved these two buttons do nothing — grey them out, or they look
      // clickable while clicking them achieves nothing.
      const solved = session.isSolved;
      this.#moves.textContent = String(session.moves);
      this.#pushes.textContent = String(session.pushes);
      this.#undo.disabled = solved || !session.canUndo;
      this.#restartBtn.disabled = solved;
    };

    refresh();
    return session.onChange(refresh);
  }
}
