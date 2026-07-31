/** The level-picker grid. Unlocks sequentially; cleared levels show their best move count. */
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
      empty.textContent = 'This level set is empty — there is nothing to play yet.';
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
      best.textContent = record.completed ? `${record.bestMoves} moves` : '';

      button.append(num, best);
      button.addEventListener('click', () => this.#onPick(index));
      this.#grid.append(button);
    });
  }
}
