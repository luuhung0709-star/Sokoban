import { Command } from '../input/inputRouter.js';

/** The info bar on top and the button row below. Follows the session via onChange. */
export class Hud {
  #name;
  #moves;
  #pushes;
  #undo;

  constructor(rootEl, router) {
    this.#name = rootEl.querySelector('#hud-name');
    this.#moves = rootEl.querySelector('#hud-moves');
    this.#pushes = rootEl.querySelector('#hud-pushes');
    this.#undo = rootEl.querySelector('#btn-undo');

    // No Restart button here. Restarting is the R key, or the Restart row in the Settings
    // sheet — one button per row of the toolbar is enough, and it was the least pressed.
    router.bindButton(this.#undo, Command.Undo);
    router.bindButton(rootEl.querySelector('#btn-exit'), Command.Exit);
  }

  setLevelLabel(text) {
    this.#name.textContent = text;
  }

  /**
   * Returns an unbind function, so changing level leaves no listener on the old session.
   *
   * `refresh` closes over the session it was bound to and the hud keeps no session of its
   * own, so unbinding late — after the next level has already bound — drops only this
   * session's listener and cannot disturb the live one.
   */
  bind(session) {
    const refresh = () => {
      // Once solved Undo does nothing — grey it out, or it stays looking clickable while
      // clicking it achieves nothing.
      this.#moves.textContent = String(session.moves);
      this.#pushes.textContent = String(session.pushes);
      this.#undo.disabled = session.isSolved || !session.canUndo;
    };

    refresh();
    return session.onChange(refresh);
  }
}
