import { Command } from '../input/inputRouter.js';

/** How long the button admits it found nothing before going back to inviting a press. */
const NO_HINT_MS = 2000;

/** The info bar on top and the button row below. Follows the session via onChange. */
export class Hud {
  #name;
  #moves;
  #pushes;
  #undo;
  #hint;

  #session = null;
  #hintBusy = false;
  #noHintTimer = null;

  constructor(rootEl, router) {
    this.#name = rootEl.querySelector('#hud-name');
    this.#moves = rootEl.querySelector('#hud-moves');
    this.#pushes = rootEl.querySelector('#hud-pushes');
    this.#undo = rootEl.querySelector('#btn-undo');
    this.#hint = rootEl.querySelector('#btn-hint');

    // No Restart button here. Restarting is the R key, or the Restart row in the Settings
    // sheet — one button per row of the toolbar is enough, and it was the least pressed.
    router.bindButton(this.#undo, Command.Undo);
    router.bindButton(this.#hint, Command.Hint);
    router.bindButton(rootEl.querySelector('#btn-exit'), Command.Exit);
  }

  setLevelLabel(text) {
    this.#name.textContent = text;
  }

  /** Returns an unbind function, so changing level leaves no listener on the old session. */
  bind(session) {
    this.#session = session;
    this.#hintBusy = false;
    this.#clearNoHint();

    const refresh = () => {
      // Once solved these buttons do nothing — grey them out, or they look clickable
      // while clicking them achieves nothing.
      const solved = session.isSolved;
      this.#moves.textContent = String(session.moves);
      this.#pushes.textContent = String(session.pushes);
      this.#undo.disabled = solved || !session.canUndo;
      this.#refreshHint();
    };

    refresh();
    const off = session.onChange(refresh);

    return () => {
      off();
      // Only drop the session if it is still ours: unbinding after the next level has
      // already bound would otherwise blank out the live one.
      if (this.#session === session) {
        this.#session = null;
        this.#refreshHint();
      }
    };
  }

  /** A search is in flight: say so, and refuse a second press until it lands. */
  setHintBusy(on) {
    this.#hintBusy = Boolean(on);
    if (this.#hintBusy) this.#clearNoHint();
    this.#refreshHint();
  }

  /** The solver came back empty. The button is where the player is looking, so say it there. */
  flashNoHint() {
    this.#clearNoHint();
    this.#hint.textContent = '💡 No hint';
    this.#noHintTimer = setTimeout(() => {
      this.#noHintTimer = null;
      this.#refreshHint();
    }, NO_HINT_MS);
  }

  /**
   * Cancels a running message. Without this, pressing twice in a row lets the first
   * timer fire late and wipe the label the second press just put up.
   */
  #clearNoHint() {
    if (this.#noHintTimer === null) return;
    clearTimeout(this.#noHintTimer);
    this.#noHintTimer = null;
  }

  #refreshHint() {
    this.#hint.disabled = this.#hintBusy || !this.#session || this.#session.isSolved;

    if (this.#hintBusy) this.#hint.textContent = '💡 Thinking…';
    else if (this.#noHintTimer === null) this.#hint.textContent = '💡 Hint';
  }
}
