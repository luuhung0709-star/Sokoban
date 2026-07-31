import { WALL, countPieces } from './sokobanChars.js';

/**
 * Checks the structure of a level. Does NOT check whether the level is solvable —
 * writing a Sokoban solver is a problem of its own, and out of scope.
 */
export function validateLevel(level) {
  if (!level || !level.rows || level.rows.length === 0) return ['Empty level'];

  const issues = [];
  const { players, boxes, goals, playerPos } = countPieces(level.rows);

  if (players !== 1) issues.push(`Must have exactly one player, found ${players}`);
  if (boxes === 0) issues.push('Level has no boxes');
  else if (boxes !== goals) issues.push(`Box count (${boxes}) differs from goal count (${goals})`);

  if (players === 1 && !isEnclosed(level, playerPos)) {
    issues.push('Play area is not sealed — the player can walk off the grid');
  }

  return issues;
}

/** Flood from the player; reaching outside the grid means the walls do not enclose it. */
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
