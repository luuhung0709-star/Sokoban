/** Màn hình đầu: chơi tiếp, chọn màn, bật tắt tiếng. */
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

  refresh(progress, collectionName) {
    const last = progress.getLastPlayedIndex(collectionName);
    this.#continueBtn.textContent = last > 0 ? `Chơi tiếp (màn ${last + 1})` : 'Chơi';

    const muted = progress.muted;
    this.#muteBtn.textContent = muted ? 'Tiếng: tắt' : 'Tiếng: bật';
    this.#muteBtn.setAttribute('aria-pressed', String(muted));
  }
}
