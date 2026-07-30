/** Bảy ký tự của định dạng Sokoban chuẩn. */
export const WALL = '#';
export const FLOOR = ' ';
export const PLAYER = '@';
export const PLAYER_ON_GOAL = '+';
export const BOX = '$';
export const BOX_ON_GOAL = '*';
export const GOAL = '.';

const GRID_CHARS = new Set([WALL, FLOOR, PLAYER, PLAYER_ON_GOAL, BOX, BOX_ON_GOAL, GOAL]);

export function isGrid(c) {
  return GRID_CHARS.has(c);
}

/** Ký tự lưới khác nền trống — dùng để phân biệt hàng lưới với dòng chữ. */
export function isContent(c) {
  return isGrid(c) && c !== FLOOR;
}

/**
 * Đếm người chơi, hộp và đích trên một mảy hàng, kèm vị trí người chơi.
 *
 * Dùng chung cho parser và validator: cả hai đều cần đúng ba con số này, và
 * lệ đếm có chỗ dễ quên — '*' tính cả vào hộp lẫn đích, '+' tính cả vào người
 * lẫn đích. Viết riêng mỗi nơi một vòng lặp thì sửa lệ phải sửa hai chỗ.
 */
export function countPieces(rows) {
  let players = 0, boxes = 0, goals = 0;
  let playerPos = null;

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === PLAYER || c === PLAYER_ON_GOAL) {
        players++;
        playerPos = { x, y };
      }
      if (c === BOX || c === BOX_ON_GOAL) boxes++;
      if (c === GOAL || c === BOX_ON_GOAL || c === PLAYER_ON_GOAL) goals++;
    }
  }

  return { players, boxes, goals, playerPos };
}
