import { CellType, boxKey, parseBoxKey } from '../core/board.js';
import { Direction } from '../core/direction.js';

const ART = 'assets/art';

const PLAYER_SPRITE = {
  [Direction.Up]: `${ART}/player_up.png`,
  [Direction.Down]: `${ART}/player_down.png`,
  [Direction.Left]: `${ART}/player_left.png`,
  [Direction.Right]: `${ART}/player_right.png`,
};

/**
 * Tư thế đang áp vào hộp — art TUỲ CHỌN, hiện chưa có file.
 *
 * Thiếu file thì lặng lẽ lùi về sprite thường chứ không hiện ô hồng báo lỗi như
 * art bắt buộc: game vẫn chơi được trọn vẹn khi không có bộ này, nên thiếu nó
 * không phải hỏng. Thả bốn file vào `assets/art/` là chạy, không phải sửa code.
 */
const PLAYER_PUSH_SPRITE = {
  [Direction.Up]: `${ART}/player_push_up.png`,
  [Direction.Down]: `${ART}/player_push_down.png`,
  [Direction.Left]: `${ART}/player_push_left.png`,
  [Direction.Right]: `${ART}/player_push_right.png`,
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
  #facing = Direction.Down;
  #pushing = false;
  // Sprite đẩy nào tải hỏng thì ghi vào đây, lần sau không thử lại. Cố ý KHÔNG
  // xoá khi dựng màn mới: file thiếu ở màn này thì màn sau cũng thiếu.
  #missingPush = new Set();

  constructor(rootEl) {
    this.#root = rootEl;
    this.playerEl = null;
  }

  build(board) {
    this.#root.textContent = '';
    this.#boxes.clear();
    // Khớp với sprite mà #makePlayer dựng ra, không thì lần đổi hướng đầu tiên
    // sang Down bị bỏ qua vì tưởng đã đúng rồi.
    this.#facing = Direction.Down;
    this.#pushing = false;

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
      const { x, y } = parseBoxKey(key);
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

    // Đo content box, không dùng getBoundingClientRect: rect gồm cả padding nên
    // cỡ ô bị tính vượt và bàn cờ tràn qua lề. clientWidth/Height là padding box,
    // trừ padding ra thì còn đúng chỗ vẽ được.
    const style = getComputedStyle(stage);
    const availableWidth = stage.clientWidth
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = stage.clientHeight
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    const byWidth = availableWidth / board.width;
    const byHeight = availableHeight / board.height;

    this.#cell = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(Math.min(byWidth, byHeight))));
    this.#root.style.setProperty('--cell', `${this.#cell}px`);

    // Transform tính bằng px nên mọi actor phải được đặt lại sau khi đổi cỡ ô.
    for (const [key, el] of this.#boxes) {
      const { x, y } = parseBoxKey(key);
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

  /**
   * Hộp trên đích chỉ cần đổi class — phần vẽ (đổi dấu X thành vòng tròn) nằm
   * trọn trong board.css.
   */
  refreshBoxLook(board) {
    for (const [key, el] of this.#boxes) {
      const { x, y } = parseBoxKey(key);
      el.classList.toggle('actor--on-goal', board.cellAt(x, y) === CellType.Goal);
    }
  }

  setPlayerFacing(dir) {
    if (!PLAYER_SPRITE[dir]) return;
    this.#facing = dir;
    this.#updatePlayerSprite();
  }

  /** Nhân vật đang áp mặt vào hộp — đổi sang tư thế đẩy nếu có art. */
  setPlayerPushing(on) {
    this.#pushing = Boolean(on);
    this.#updatePlayerSprite();
  }

  get playerFacing() { return this.#facing; }

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

    // Sàn một tông duy nhất — kiểu caro xen kẽ hai màu đã bỏ.
    tile.className = 'tile tile--floor';
    if (cell === CellType.Goal) tile.classList.add('tile--goal');
    return tile;
  }

  /**
   * Hộp không dùng file ảnh nào: `.actor__face` là mặt hộp, hai pseudo-element
   * của nó là dấu X (hoặc vòng tròn khi đã vào đích). Xem board.css.
   */
  #makeBox() {
    const el = document.createElement('div');
    el.className = 'actor actor--box';
    const face = document.createElement('i');
    face.className = 'actor__face';
    el.append(face);
    return el;
  }

  #makePlayer() {
    const el = document.createElement('div');
    el.className = 'actor actor--player';

    const img = document.createElement('img');
    img.className = 'actor__sprite';
    img.alt = '';
    img.dataset.src = PLAYER_SPRITE[Direction.Down];
    img.src = img.dataset.src;
    img.addEventListener('error', () => this.#onPlayerSpriteError(img));

    el.append(img);
    return el;
  }

  /** Chọn sprite theo hướng nhìn và trạng thái đẩy hiện tại. */
  #updatePlayerSprite() {
    const img = this.playerEl?.querySelector('.actor__sprite');
    if (!img) return;

    const push = PLAYER_PUSH_SPRITE[this.#facing];
    const src = this.#pushing && !this.#missingPush.has(push)
      ? push
      : PLAYER_SPRITE[this.#facing];

    // So bằng dataset chứ không bằng `img.src`: trình duyệt trả về `img.src` dưới
    // dạng URL tuyệt đối nên so với đường dẫn tương đối sẽ không bao giờ khớp, và
    // ta gán lại ảnh sau mỗi nước đi một cách vô ích.
    if (img.dataset.src === src) return;
    img.dataset.src = src;
    img.src = src;
  }

  /**
   * Sprite đẩy thiếu là chuyện bình thường (art tuỳ chọn): ghi nhớ rồi lùi về
   * sprite thường. Sprite thường thiếu mới là hỏng thật — hiện ô hồng chói kèm
   * lỗi, không im lặng bỏ trống.
   */
  #onPlayerSpriteError(img) {
    const failed = img.dataset.src;

    if (Object.values(PLAYER_PUSH_SPRITE).includes(failed)) {
      this.#missingPush.add(failed);
      this.#updatePlayerSprite();
      return;
    }

    img.parentElement?.classList.add('actor--missing');
    console.error(`BoardRenderer: không tải được sprite ${failed}`);
  }
}
