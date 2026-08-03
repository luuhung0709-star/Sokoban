import { CellType } from './board.js';
import { Direction, toDelta } from './direction.js';

const DIRECTIONS = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];

/**
 * The unchanging part of a level, flattened from `statics[y][x]` to a single index
 * `y * width + x`.
 *
 * Flat typed arrays rather than the nested arrays the game uses: the search touches
 * these millions of times, and a flat index is also what lets a whole box layout be
 * compared as one sorted list of numbers.
 */
export function buildStatics(snapshot) {
  const { width, height, statics } = snapshot;
  const size = width * height;
  const wall = new Uint8Array(size);
  const goal = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = statics[y][x];
      if (cell === CellType.Wall) wall[y * width + x] = 1;
      if (cell === CellType.Goal) goal[y * width + x] = 1;
    }
  }

  const steps = DIRECTIONS.map((dir) => ({ dir, ...toDelta(dir) }));

  return { width, height, size, wall, goal, steps };
}

/**
 * The index one step away, or -1 when that leaves the grid.
 *
 * The bounds check is on x and y, NOT on the flat index: `index ± 1` would happily
 * wrap from the end of one row to the start of the next, and the search would plan
 * pushes straight through the side of the board.
 */
export function neighbourAt(statics, index, dx, dy) {
  const x = index % statics.width;
  const y = (index - x) / statics.width;
  const nx = x + dx;
  const ny = y + dy;

  if (nx < 0 || nx >= statics.width || ny < 0 || ny >= statics.height) return -1;
  return ny * statics.width + nx;
}

export function toXY(statics, index) {
  const x = index % statics.width;
  return { x, y: (index - x) / statics.width };
}

/**
 * For every square, the fewest pushes a box there needs to reach SOME goal, ignoring
 * the other boxes and ignoring whether the player can get into position. Both of those
 * only ever make the real cost higher, so this is a true lower bound — which is exactly
 * what the search wants for a heuristic.
 *
 * Computed by running the game backwards: start on the goals and PULL boxes outwards.
 * A box at `prev` can be pushed onto `at` when `prev` is floor and the square behind it
 * is floor too, because that is where the player has to stand to do the pushing.
 *
 * The squares this never reaches are dead: a box pushed there can never reach a goal
 * again, whatever anyone does. That is the single most valuable prune in the search, and
 * it falls out of the same flood fill for free.
 */
export function buildPullDistance(statics) {
  const dist = new Array(statics.size).fill(Infinity);
  const queue = [];

  for (let i = 0; i < statics.size; i++) {
    if (statics.goal[i] && !statics.wall[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];

    for (const step of statics.steps) {
      const prev = neighbourAt(statics, at, step.dx, step.dy);
      if (prev < 0 || statics.wall[prev] || dist[prev] !== Infinity) continue;

      const behind = neighbourAt(statics, prev, step.dx, step.dy);
      if (behind < 0 || statics.wall[behind]) continue;

      dist[prev] = dist[at] + 1;
      queue.push(prev);
    }
  }

  return dist;
}
