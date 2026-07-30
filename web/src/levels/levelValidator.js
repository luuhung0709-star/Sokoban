import { WALL, countPieces } from './sokobanChars.js';

/**
 * Kiểm tra cấu trúc một màn. KHÔNG kiểm tra màn có giải được hay không —
 * viết solver Sokoban là bài toán riêng, nằm ngoài phạm vi.
 */
export function validateLevel(level) {
  if (!level || !level.rows || level.rows.length === 0) return ['Màn rỗng'];

  const issues = [];
  const { players, boxes, goals, playerPos } = countPieces(level.rows);

  if (players !== 1) issues.push(`Phải có đúng một người chơi, đang có ${players}`);
  if (boxes === 0) issues.push('Màn không có hộp nào');
  else if (boxes !== goals) issues.push(`Số hộp (${boxes}) khác số đích (${goals})`);

  if (players === 1 && !isEnclosed(level, playerPos)) {
    issues.push('Vùng chơi chưa kín — người chơi đi ra ngoài lưới được');
  }

  return issues;
}

/** Loang từ chỗ người chơi; chạm được ra ngoài lưới nghĩa là tường chưa bao kín. */
function isEnclosed(level, start) {
  const height = level.rows.length;
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length > 0) {
    const p = queue.shift();
    for (const [dx, dy] of deltas) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (n.y < 0 || n.y >= height) return false;

      const row = level.rows[n.y];
      if (n.x < 0 || n.x >= row.length) return false;

      const key = `${n.x},${n.y}`;
      if (row[n.x] === WALL || seen.has(key)) continue;
      seen.add(key);
      queue.push(n);
    }
  }

  return true;
}
