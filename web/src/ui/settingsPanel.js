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
  #getState;
  #keyTarget;
  #open = false;

  constructor(rootEl, { onToggleMusic, onToggleSfx, getState, keyTarget = window }) {
    this.#root = rootEl;
    this.#musicBtn = rootEl.querySelector('#btn-music');
    this.#sfxBtn = rootEl.querySelector('#btn-sfx');
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
    rootEl.querySelector('#btn-settings-close').addEventListener('click', () => this.hide());

    this.onKeyDown = this.onKeyDown.bind(this);
  }

  show() {
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
    const { musicOn, sfxOn } = this.#getState();
    setSwitch(this.#musicBtn, 'Music', musicOn);
    setSwitch(this.#sfxBtn, 'Sound effects', sfxOn);
  }

  /**
   * Registered on the CAPTURE phase, so it runs before InputRouter's listener on the same
   * window and can stop it. Without this the arrow keys would walk the player about
   * behind the overlay, and Escape would leave the level rather than close the panel.
   */
  onKeyDown(event) {
    event.stopPropagation();
    if (event.code === 'Escape') this.hide();
  }
}

/**
 * State goes on `aria-pressed` alone, and the CSS draws the switch from that attribute.
 * One source of truth: a separate class for the look could drift out of step with what a
 * screen reader announces.
 *
 * The visible label is static markup — it carries an icon, and it is shortened to fit
 * half a row — so the full name is spelled out here instead.
 */
function setSwitch(button, name, on) {
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', `${name}: ${on ? 'on' : 'off'}`);
}
