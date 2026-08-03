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
 * The pose while braced against a box — OPTIONAL art.
 *
 * A missing file falls back quietly to the normal sprite instead of showing the pink
 * error tile that required art does: the game plays perfectly well without this set,
 * so its absence is not a fault. Drop the four files into `assets/art/` and they work,
 * no code change needed.
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
 * The hint arrow is drawn pointing up, so each direction is just a quarter turn from
 * there. Keeping the art at one angle means one clip-path instead of four.
 */
const HINT_ROTATION = {
  [Direction.Up]: 0,
  [Direction.Right]: 90,
  [Direction.Down]: 180,
  [Direction.Left]: 270,
};

/**
 * Builds the static part of a level once and leaves it alone, while the player and
 * boxes are absolutely-positioned elements moved by transform. The same static
 * Tilemap + dynamic GameObject split the Unity build used.
 */
export class BoardRenderer {
  #root;
  #statics;
  #actors;
  #boxes = new Map();   // "x,y" -> box element
  #cell = 44;
  #facing = Direction.Down;
  #pushing = false;
  // Push sprites that failed to load land here and are not retried. Deliberately NOT
  // cleared when building a new level: a file missing here is missing there too.
  #missingPush = new Set();
  #hintEl = null;

  constructor(rootEl) {
    this.#root = rootEl;
    this.playerEl = null;
  }

  build(board) {
    this.#root.textContent = '';
    this.#boxes.clear();
    // The whole tree is about to be replaced, so the old hint element is already gone.
    // Drop the reference too, or clearHint would poke at a detached node.
    this.#hintEl = null;
    // Match the sprite #makePlayer builds, or the first turn to Down gets skipped
    // because it looks like it is already correct.
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

  /** Cell size from the space left over, clamped to 20–64px. */
  fitCellSize(board) {
    const stage = this.#root.parentElement ?? document.body;

    // Measure the content box, not getBoundingClientRect: the rect includes padding,
    // so the cell size comes out too big and the board spills past the margin.
    // clientWidth/Height is the padding box; subtracting padding leaves the drawable area.
    const style = getComputedStyle(stage);
    const availableWidth = stage.clientWidth
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = stage.clientHeight
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    const byWidth = availableWidth / board.width;
    const byHeight = availableHeight / board.height;

    this.#cell = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(Math.min(byWidth, byHeight))));
    this.#root.style.setProperty('--cell', `${this.#cell}px`);

    // Transforms are in px, so every actor has to be replaced after a cell resize.
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
   * A box on a goal only needs a class change — the drawing (swapping the X for a
   * circle) lives entirely in board.css.
   */
  refreshBoxLook(board) {
    for (const [key, el] of this.#boxes) {
      const { x, y } = parseBoxKey(key);
      el.classList.toggle('actor--on-goal', board.cellAt(x, y) === CellType.Goal);
    }
  }

  /**
   * Marks the box the solver says to push next, and which way. Only the box is shown,
   * not the walk to it: working out how to get behind the box is the easy half of
   * Sokoban, and doing it for the player would give the whole level away.
   */
  showHint({ x, y }, dir) {
    this.clearHint();

    const el = this.boxElAt(x, y);
    // The hint may arrive after the board moved on. Nothing to point at is not a fault.
    if (!el) return;

    const arrow = document.createElement('i');
    arrow.className = 'actor__hint-arrow';
    arrow.style.setProperty('--hint-rot', `${HINT_ROTATION[dir] ?? 0}deg`);

    el.classList.add('actor--hint');
    el.append(arrow);
    this.#hintEl = el;
  }

  clearHint() {
    if (!this.#hintEl) return;

    this.#hintEl.classList.remove('actor--hint');
    this.#hintEl.querySelector('.actor__hint-arrow')?.remove();
    this.#hintEl = null;
  }

  setPlayerFacing(dir) {
    if (!PLAYER_SPRITE[dir]) return;
    this.#facing = dir;
    this.#updatePlayerSprite();
  }

  /** The player is braced against a box — switch to the push pose if that art exists. */
  setPlayerPushing(on) {
    this.#pushing = Boolean(on);
    this.#updatePlayerSprite();
  }

  get playerFacing() { return this.#facing; }

  /** Position immediately, with no animation. */
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

    // A single floor tone — the two-colour checkerboard was dropped.
    tile.className = 'tile tile--floor';
    if (cell === CellType.Goal) tile.classList.add('tile--goal');
    return tile;
  }

  /**
   * Boxes use no image file at all: `.actor__face` is the box face and its two
   * pseudo-elements draw the X (or a circle once on a goal). See board.css.
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

  /** Picks the sprite from the current facing and push state. */
  #updatePlayerSprite() {
    const img = this.playerEl?.querySelector('.actor__sprite');
    if (!img) return;

    const push = PLAYER_PUSH_SPRITE[this.#facing];
    const src = this.#pushing && !this.#missingPush.has(push)
      ? push
      : PLAYER_SPRITE[this.#facing];

    // Compare via dataset, not `img.src`: the browser hands back `img.src` as an
    // absolute URL, so it never matches a relative path and we would pointlessly
    // reassign the image after every move.
    if (img.dataset.src === src) return;
    img.dataset.src = src;
    img.src = src;
  }

  /**
   * A missing push sprite is normal (the art is optional): remember it and fall back
   * to the normal sprite. A missing normal sprite is a real fault — show the glaring
   * pink tile and log an error rather than leaving a silent gap.
   */
  #onPlayerSpriteError(img) {
    const failed = img.dataset.src;

    if (Object.values(PLAYER_PUSH_SPRITE).includes(failed)) {
      this.#missingPush.add(failed);
      this.#updatePlayerSprite();
      return;
    }

    img.parentElement?.classList.add('actor--missing');
    console.error(`BoardRenderer: could not load sprite ${failed}`);
  }
}
