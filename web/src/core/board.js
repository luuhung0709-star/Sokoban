import {
  WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, PLAYER, PLAYER_ON_GOAL,
} from '../levels/sokobanChars.js';

export const CellType = Object.freeze({
  Wall: 'Wall',
  Floor: 'Floor',
  Goal: 'Goal',
});

/**
 * Hộp lưu trong Set dưới dạng khoá chuỗi "x,y". JS so sánh object theo tham chiếu
 * nên Set chứa {x,y} sẽ không nhận ra hai toạ độ bằng nhau — đây là khác biệt bắt
 * buộc so với HashSet<Vector2Int> bên C#.
 */
export const boxKey = (x, y) => `${x},${y}`;

export function parseBoxKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/** Trạng thái một màn đang chơi. Lưới tĩnh không đổi; người chơi và hộp thì đổi. */
export class Board {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    // statics[y][x] — cùng thứ tự với LevelData.rows nên đọc code đỡ phải đảo đầu.
    this.statics = Array.from({ length: height }, () => new Array(width).fill(CellType.Floor));
    this.player = { x: 0, y: 0 };
    this.boxes = new Set();
  }

  /** Ngoài lưới coi như tường, nên nơi khác không cần kiểm tra biên. */
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
        // Hàng ngắn hơn width thì phần thiếu là nền trống.
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
