/** Bốn hướng đi. Giá trị trùng tên khoá để log ra đọc được ngay. */
export const Direction = Object.freeze({
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
});

// y tăng xuống dưới, giống thứ tự hàng trong LevelData.rows.
const DELTAS = Object.freeze({
  Up: { dx: 0, dy: -1 },
  Down: { dx: 0, dy: 1 },
  Left: { dx: -1, dy: 0 },
  Right: { dx: 1, dy: 0 },
});

export function toDelta(dir) {
  const delta = DELTAS[dir];
  // Ném lỗi chứ không trả undefined: hướng sai mà im lặng thì lỗi sẽ hiện ra ở
  // tận chỗ cộng toạ độ, xa chỗ gây ra nó.
  if (!delta) throw new Error(`Hướng không hợp lệ: ${dir}`);
  return delta;
}
