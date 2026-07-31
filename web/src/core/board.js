import {
  WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, PLAYER, PLAYER_ON_GOAL,
} from '../levels/sokobanChars.js';

export const CellType = Object.freeze({
  Wall: 'Wall',
  Floor: 'Floor',
  Goal: 'Goal',
});

/**
 * Boxes live in a Set as "x,y" string keys. JS compares objects by reference, so a
 * Set of {x,y} would never recognise two equal coordinates — a forced difference
 * from the HashSet<Vector2Int> the C# original used.
 */
export const boxKey = (x, y) => `${x},${y}`;

export function parseBoxKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/** State of a level in play. The static grid never changes; the player and boxes do. */
export class Board {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    // statics[y][x] — same order as LevelData.rows, so reading the code needs no mental flip.
    this.statics = Array.from({ length: height }, () => new Array(width).fill(CellType.Floor));
    this.player = { x: 0, y: 0 };
    this.boxes = new Set();
  }

  /** Outside the grid counts as wall, so nowhere else has to bounds-check. */
  cellAt(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return CellType.Wall;
    return this.statics[y][x];
  }

  hasBox(x, y) {
    return this.boxes.has(boxKey(x, y));
  }

  get isSolved() {
    for (const key of this.boxes) {
      const { x, y } = parseBoxKey(key);
      if (this.cellAt(x, y) !== CellType.Goal) return false;
    }
    return true;
  }

  static fromLevel(level) {
    const board = new Board(level.width, level.height);

    for (let y = 0; y < level.height; y++) {
      const row = level.rows[y];
      for (let x = 0; x < level.width; x++) {
        // Rows shorter than width: the missing part is empty floor.
        const c = x < row.length ? row[x] : FLOOR;

        if (c === WALL) board.statics[y][x] = CellType.Wall;
        else if (c === GOAL || c === BOX_ON_GOAL || c === PLAYER_ON_GOAL) board.statics[y][x] = CellType.Goal;
        else board.statics[y][x] = CellType.Floor;

        if (c === PLAYER || c === PLAYER_ON_GOAL) board.player = { x, y };
        if (c === BOX || c === BOX_ON_GOAL) board.boxes.add(boxKey(x, y));
      }
    }

    return board;
  }
}
