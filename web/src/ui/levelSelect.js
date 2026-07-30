/** Lưới nút chọn màn. Mở khoá tuần tự, màn đã qua hiện số bước tốt nhất. */
export class LevelSelect {
  #grid;
  #onPick;

  constructor(rootEl, { onPick, onBack }) {
    this.#grid = rootEl.querySelector('#levels');
    this.#onPick = onPick;
    rootEl.querySelector('#btn-levels-back').addEventListener('click', onBack);
  }

  render(levels, progress, collectionName) {
    this.#grid.textContent = '';

    if (levels.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Bộ màn trống — chưa có màn nào để chơi.';
      this.#grid.append(empty);
      return;
    }

    levels.forEach((level, index) => {
      const record = progress.getRecord(collectionName, index);
      const unlocked = progress.isUnlocked(collectionName, index);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `level-btn${record.completed ? ' level-btn--done' : ''}`;
      button.disabled = !unlocked;

      const num = document.createElement('span');
      num.className = 'level-btn__num';
      num.textContent = record.completed ? `✓ ${level.name}` : level.name;

      const best = document.createElement('span');
      best.className = 'level-btn__best';
      best.textContent = record.completed ? `${record.bestMoves} bước` : '';

      button.append(num, best);
      button.addEventListener('click', () => this.#onPick(index));
      this.#grid.append(button);
    });
  }
}
