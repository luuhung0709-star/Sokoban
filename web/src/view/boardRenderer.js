import { CellType, boxKey } from '../core/board.js';
import { Direction } from '../core/direction.js';

const ART = 'assets/art';

const PLAYER_SPRITE = {
  [Direction.Up]: `${ART}/player_up.png`,
  [Direction.Down]: `${ART}/player_down.png`,
  [Direction.Left]: `${ART}/player_left.png`,
  [Direction.Right]: `${ART}/player_right.png`,
};

const CELL_MIN = 20;
const CELL_MAX = 64;

/**
 * Dựng phần tĩnh của màn một lần rồi để yên, còn người chơi và hộp là phần tử
 * absolute di chuyển bằng transform. Chính là kiểu Tilemap tĩnh + GameObject
 * động của bản Unity.
 */
export class BoardRenderer {
  #root;
  #statics;
  #actors;
  #boxes = new Map();   // "x,y" -> phần tử hộp
  #cell = 44;

  constructor(rootEl) {
    this.#root = rootEl;
    this.playerEl = null;
  }

  build(board) {
    this.#root.textContent = '';
    this.#boxes.clear();

    this.#root.style.setProperty('--cols', String(board.width));
    this.#root.style.setProperty('--rows', String(board.height));

    this.#statics = document.createElement('div');
    this.#statics.className = 'board__statics';
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        this.#statics.append(this.#makeTile(board, x, y));
      }
    }

    this.#actors = document.createElement('div');
    this.#actors.className = 'board__actors';

    for (const key of board.boxes) {
      const [x, y] = key.split(',').map(Number);
      const el = this.#makeBox();
      this.#place(el, x, y);
      this.#boxes.set(key, el);
      this.#actors.append(el);
    }

    this.playerEl = this.#makePlayer();
    this.#place(this.playerEl, board.player.x, board.player.y);
    this.#actors.append(this.playerEl);

    this.#root.append(this.#statics, this.#actors);
    this.refreshBoxLook(board);
  }

  /** Kích thước ô theo chỗ trống còn lại, kẹp trong 20–64px. */
  fitCellSize(board) {
    const stage = this.#root.parentElement ?? document.body;
    const available = stage.getBoundingClientRect();
    const byWidth = available.width / board.width;
    const byHeight = available.height / board.height;

    this.#cell = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(Math.min(byWidth, byHeight))));
    this.#root.style.setProperty('--cell', `${this.#cell}px`);

    // Transform tính bằng px nên mọi actor phải được đặt lại sau khi đổi cỡ ô.
    for (const [key, el] of this.#boxes) {
      const [x, y] = key.split(',').map(Number);
      this.#place(el, x, y);
    }
    if (this.playerEl) this.#place(this.playerEl, board.player.x, board.player.y);
  }

  get cellSize() { return this.#cell; }

  boxElAt(x, y) {
    return this.#boxes.get(boxKey(x, y)) ?? null;
  }

  rekeyBox(fromX, fromY, toX, toY) {
    const el = this.#boxes.get(boxKey(fromX, fromY));
    if (!el) return;
    this.#boxes.delete(boxKey(fromX, fromY));
    this.#boxes.set(boxKey(toX, toY), el);
  }

  /** Hộp trên đích đổi sprite và tắt dấu X. */
  refreshBoxLook(board) {
    for (const [key, el] of this.#boxes) {
      const [x, y] = key.split(',').map(Number);
      const onGoal = board.cellAt(x, y) === CellType.Goal;
      el.querySelector('.actor__sprite').src = onGoal
        ? `${ART}/box_on_goal.png`
        : `${ART}/box.png`;
      el.querySelector('.actor__mark').hidden = onGoal;
    }
  }

  setPlayerFacing(dir) {
    const src = PLAYER_SPRITE[dir];
    if (src) this.playerEl.querySelector('.actor__sprite').src = src;
  }

  /** Đặt vị trí tức thì, không animation. */
  placeActor(el, x, y) {
    this.#place(el, x, y);
  }

  #place(el, x, y) {
    el.style.transform = `translate(${x * this.#cell}px, ${y * this.#cell}px)`;
  }

  #makeTile(board, x, y) {
    const cell = board.cellAt(x, y);
    const tile = document.createElement('i');

    if (cell === CellType.Wall) {
      tile.className = 'tile tile--wall';
      return tile;
    }

    tile.className = `tile tile--floor-${(x + y) % 2 === 0 ? 'a' : 'b'}`;
    if (cell === CellType.Goal) {
      tile.classList.add('tile--goal');
      tile.append(this.#makeImg(`${ART}/mark_o.png`, 'tile__sprite', 'tile--missing'));
    }
    return tile;
  }

  #makeBox() {
    const el = document.createElement('div');
    el.className = 'actor actor--box';
    el.append(this.#makeImg(`${ART}/box.png`, 'actor__sprite', 'actor--missing'));
    el.append(this.#makeImg(`${ART}/mark_x.png`, 'actor__mark', 'actor--missing'));
    return el;
  }

  #makePlayer() {
    const el = document.createElement('div');
    el.className = 'actor actor--player';
    el.append(this.#makeImg(PLAYER_SPRITE[Direction.Down], 'actor__sprite', 'actor--missing'));
    return el;
  }

  #makeImg(src, className, missingClass) {
    const img = document.createElement('img');
    img.className = className;
    img.alt = '';
    img.src = src;
    // Thiếu file art thì hiện ô hồng chói kèm lỗi, không im lặng bỏ trống.
    img.addEventListener('error', () => {
      img.parentElement?.classList.add(missingClass);
      console.error(`BoardRenderer: không tải được sprite ${src}`);
    });
    return img;
  }
}
