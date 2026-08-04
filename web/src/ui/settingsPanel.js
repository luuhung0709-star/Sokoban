/**
 * The settings overlay: one switch for the music, one for the effects.
 *
 * It lives outside every `.screen` because it opens from the main menu and from the
 * board alike — unlike the level-complete overlay, which sits inside `.stage` and so only
 * exists while a level is up.
 *
 * `keyTarget` is injected so tests can hand in a stand-in for `window`.
 */
export class SettingsPanel {
  #root;
  #musicBtn;
  #sfxBtn;
  #listView;
  #tutorialView;
  #title;
  #backBtn;
  #restartRow;
  #getState;
  #keyTarget;
  #open = false;
  #onTutorial = false;

  constructor(rootEl, { onToggleMusic, onToggleSfx, onRestart, getState, keyTarget = window }) {
    this.#root = rootEl;
    this.#musicBtn = rootEl.querySelector('#btn-music');
    this.#sfxBtn = rootEl.querySelector('#btn-sfx');
    this.#listView = rootEl.querySelector('#settings-list');
    this.#tutorialView = rootEl.querySelector('#settings-tutorial');
    this.#title = rootEl.querySelector('#settings-title');
    this.#backBtn = rootEl.querySelector('#btn-settings-back');
    this.#restartRow = rootEl.querySelector('#row-restart');
    this.#getState = getState;
    this.#keyTarget = keyTarget;

    this.#musicBtn.addEventListener('click', () => {
      onToggleMusic();
      this.refresh();
    });
    this.#sfxBtn.addEventListener('click', () => {
      onToggleSfx();
      this.refresh();
    });
    rootEl.querySelector('#btn-tutorial').addEventListener('click', () => this.#setView(true));
    this.#backBtn.addEventListener('click', () => this.#setView(false));
    rootEl.querySelector('#btn-settings-close').addEventListener('click', () => this.hide());
    rootEl.querySelector('#btn-settings-restart').addEventListener('click', () => {
      // hide() runs first: if onRestart() throws, the panel still closes rather than
      // being left open with its capture-phase key listener still swallowing every key.
      this.hide();
      onRestart();
    });

    this.onKeyDown = this.onKeyDown.bind(this);
  }

  show() {
    // Always open on the list. Closing the panel from the tutorial and opening it again
    // must not drop the player back into the middle of it.
    this.#setView(false);
    this.refresh();
    this.#root.hidden = false;

    // Guard against a second show: addEventListener would take the same function twice
    // and every key would be handled twice over.
    if (this.#open) return;
    this.#open = true;
    this.#keyTarget.addEventListener('keydown', this.onKeyDown, true);
  }

  hide() {
    this.#root.hidden = true;
    if (!this.#open) return;
    this.#open = false;
    this.#keyTarget.removeEventListener('keydown', this.onKeyDown, true);
  }

  refresh() {
    const { musicOn, sfxOn, playing } = this.#getState();
    setSwitch(this.#musicBtn, musicOn);
    setSwitch(this.#sfxBtn, sfxOn);

    // Nothing to restart from the menu. The row goes away rather than sitting there
    // greyed out: a dead button invites a click that does nothing.
    this.#restartRow.hidden = !playing;
  }

  /**
   * Swaps the two views. Both live in the same overlay so the sheet keeps its frame,
   * its key handling and its close button across the switch — a second overlay would
   * have to duplicate all three.
   */
  #setView(onTutorial) {
    this.#onTutorial = onTutorial;
    this.#listView.hidden = onTutorial;
    this.#tutorialView.hidden = !onTutorial;
    this.#backBtn.hidden = !onTutorial;
    this.#title.textContent = onTutorial ? 'How to play' : 'Settings';
  }

  /**
   * Registered on the CAPTURE phase, so it runs before InputRouter's listener on the same
   * window and can stop it. Without this the arrow keys would walk the player about
   * behind the overlay, and Escape would leave the level rather than close the panel.
   */
  onKeyDown(event) {
    event.stopPropagation();
    if (event.code !== 'Escape') return;

    // Escape means "back one step", not "close": from the tutorial it returns to the
    // list, and only from the list does it put the panel away.
    if (this.#onTutorial) this.#setView(false);
    else this.hide();
  }
}

/**
 * State goes on `aria-pressed` alone, and the CSS draws the switch from that attribute.
 * One source of truth: a separate class for the look could drift out of step with what a
 * screen reader announces.
 *
 * No `aria-label` here on purpose: the visible text ("Sounds" / "Music") is already the
 * button's accessible name, and WCAG 2.5.3 Label in Name requires the accessible name to
 * contain the visible label — a longer label such as `Sound effects: on` would not, so a
 * speech-control user saying "click Sounds" could not activate the button. `aria-pressed`
 * alone is enough to carry state; a screen reader already appends "pressed" / "not
 * pressed" from it, so a state-bearing `aria-label` would only announce it twice.
 */
function setSwitch(button, on) {
  button.setAttribute('aria-pressed', String(on));
}
