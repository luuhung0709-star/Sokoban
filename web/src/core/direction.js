/** The four directions. Values match their key names so logs read straight off. */
export const Direction = Object.freeze({
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
});

// y grows downwards, matching the row order in LevelData.rows.
const DELTAS = Object.freeze({
  Up: { dx: 0, dy: -1 },
  Down: { dx: 0, dy: 1 },
  Left: { dx: -1, dy: 0 },
  Right: { dx: 1, dy: 0 },
});

export function toDelta(dir) {
  const delta = DELTAS[dir];
  // Throw rather than return undefined: a bad direction that fails silently only
  // surfaces where the coordinates get added, far from what caused it.
  if (!delta) throw new Error(`Invalid direction: ${dir}`);
  return delta;
}
