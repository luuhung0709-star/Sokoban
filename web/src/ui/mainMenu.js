/** The first screen: continue, pick a level, open the settings. */
export class MainMenu {
  #continueBtn;

  constructor(rootEl, { onContinue, onSelect, onSettings }) {
    this.#continueBtn = rootEl.querySelector('#btn-continue');

    this.#continueBtn.addEventListener('click', onContinue);
    rootEl.querySelector('#btn-levels').addEventListener('click', onSelect);
    rootEl.querySelector('#btn-menu-settings').addEventListener('click', onSettings);
  }

  refresh(progress, collectionName, levels) {
    const last = Math.min(progress.getLastPlayedIndex(collectionName), levels.length - 1);
    // The number shown comes from the level's name, not index plus one — another
    // level set may use names that are not numbers.
    const name = levels[last]?.name;
    this.#continueBtn.textContent = last > 0 && name ? `Continue (level ${name})` : 'Play';
  }
}
