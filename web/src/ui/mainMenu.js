/** The first screen: continue, pick a level, toggle sound. */
export class MainMenu {
  #continueBtn;
  #muteBtn;

  constructor(rootEl, { onContinue, onSelect, onToggleMute }) {
    this.#continueBtn = rootEl.querySelector('#btn-continue');
    this.#muteBtn = rootEl.querySelector('#btn-menu-mute');

    this.#continueBtn.addEventListener('click', onContinue);
    rootEl.querySelector('#btn-levels').addEventListener('click', onSelect);
    this.#muteBtn.addEventListener('click', onToggleMute);
  }

  refresh(progress, collectionName, levels) {
    const last = Math.min(progress.getLastPlayedIndex(collectionName), levels.length - 1);
    // The number shown comes from the level's name, not index plus one — another
    // level set may use names that are not numbers.
    const name = levels[last]?.name;
    this.#continueBtn.textContent = last > 0 && name ? `Continue (level ${name})` : 'Play';

    const muted = progress.muted;
    this.#muteBtn.textContent = muted ? 'Sound: off' : 'Sound: on';
    this.#muteBtn.setAttribute('aria-pressed', String(muted));
  }
}
