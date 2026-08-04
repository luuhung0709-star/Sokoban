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

const DEFAULT_MAX_NODES = 150_000;
const DEFAULT_MAX_MS = 5_000;

/**
 * How hard the search leans on the heuristic. At 1 it returns the shortest solution and
 * takes far longer; at 2 it finds a good-enough plan several times faster. A hint only
 * has to name a push that leads somewhere, so the trade is worth taking.
 */
const WEIGHT = 2;

/** Reading the clock on every pop costs more than it saves, so check it in batches. */
const CLOCK_EVERY = 512;

/** A binary min-heap on `f`. Hand-rolled — the project takes no dependencies. */
class Heap {
  #items = [];

  get size() { return this.#items.length; }

  push(node) {
    const items = this.#items;
    items.push(node);

    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this.#items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0) return top;

    items[0] = last;
    let i = 0;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < items.length && items[left].f < items[smallest].f) smallest = left;
      if (right < items.length && items[right].f < items[smallest].f) smallest = right;
      if (smallest === i) break;
      [items[smallest], items[i]] = [items[i], items[smallest]];
      i = smallest;
    }

    return top;
  }
}

/** Every square the player can walk to, given where the boxes are. */
function reachable(statics, boxAt, from) {
  const seen = new Uint8Array(statics.size);
  seen[from] = 1;
  const queue = [from];

  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    for (const step of statics.steps) {
      const next = neighbourAt(statics, at, step.dx, step.dy);
      if (next < 0 || seen[next] || statics.wall[next] || boxAt[next]) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }

  return seen;
}

/**
 * True when the push onto `at` seals a 2×2 block of wall-or-box that traps at least one
 * box off a goal. `at` itself may sit on a goal and this can still fire — it is whichever
 * box in the sealed block is off a goal that condemns the position, not `at` specifically.
 *
 * The test is a full 2×2 block of wall-or-box. That is sound: inside a sealed 2×2 every
 * box has a blocked square on both axes drawn from the block itself, so it can be pushed
 * along neither — and the squares blocking it are walls, or boxes locked exactly the same
 * way. The block is fixed forever.
 *
 * Do NOT weaken this to "blocked on one horizontal and one vertical neighbour". A box
 * blocking from the side may itself be pushable away, so that rule prunes positions that
 * are still solvable, and the hint would go wrong rather than merely slow.
 *
 * It also does not have to catch every deadlock. Missing one only costs search time;
 * inventing one would cost correctness.
 */
function isFrozen(statics, boxAt, at) {
  const blocked = (i) => i < 0 || statics.wall[i] === 1 || boxAt[i] === 1;

  for (const [ox, oy] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
    const corner = neighbourAt(statics, at, ox, oy);
    if (corner < 0) continue;

    const cells = [
      corner,
      neighbourAt(statics, corner, 1, 0),
      neighbourAt(statics, corner, 0, 1),
      neighbourAt(statics, corner, 1, 1),
    ];
    if (!cells.every(blocked)) continue;

    // A sealed block is fine as long as every box caught in it already sits on a goal.
    if (cells.some((i) => i >= 0 && boxAt[i] === 1 && !statics.goal[i])) return true;
  }

  return false;
}

/**
 * The next push on some path to a solved board, or null.
 *
 * Searches over PUSHES, not steps. Walking the player between two pushes is free — the
 * flood fill below decides in one pass whether a push is reachable at all — so a push is
 * one edge of the graph. That makes the state space tens of times smaller than searching
 * step by step.
 *
 * Returns null when the board is already solved, when this position has no solution left
 * (the player has pushed a box somewhere fatal), or when the budget runs out. The caller
 * cannot tell those apart, and does not need to: all three mean "no hint".
 */
export function solveNextPush(snapshot, { maxNodes = DEFAULT_MAX_NODES, maxMs = DEFAULT_MAX_MS } = {}) {
  const statics = buildStatics(snapshot);
  const pullDistance = buildPullDistance(statics);

  const startBoxes = snapshot.boxes
    .map(({ x, y }) => y * statics.width + x)
    .sort((a, b) => a - b);
  const startPlayer = snapshot.player.y * statics.width + snapshot.player.x;

  if (startBoxes.every((i) => statics.goal[i] === 1)) return null;
  if (startBoxes.some((i) => pullDistance[i] === Infinity)) return null;

  const heuristic = (boxes) => boxes.reduce((sum, i) => sum + pullDistance[i], 0);

  const open = new Heap();
  const queued = new Set();
  const closed = new Set();
  const deadline = maxMs === Infinity ? Infinity : Date.now() + maxMs;

  open.push({
    boxes: startBoxes,
    player: startPlayer,
    g: 0,
    f: WEIGHT * heuristic(startBoxes),
    firstPush: null,
  });
  queued.add(`${startBoxes.join(',')}|${startPlayer}`);

  let expanded = 0;

  while (open.size > 0) {
    if (++expanded > maxNodes) return null;
    if (expanded % CLOCK_EVERY === 0 && Date.now() > deadline) return null;

    const node = open.pop();

    const boxAt = new Uint8Array(statics.size);
    for (const i of node.boxes) boxAt[i] = 1;

    const seen = reachable(statics, boxAt, node.player);

    // Where the player stands inside its region does not matter, only which region it
    // is, so states are keyed on the region's lowest square. Normalising here rather
    // than when the node was queued means one flood fill per pop instead of one per
    // successor — the same dedup for a fraction of the work.
    const key = `${node.boxes.join(',')}|${seen.indexOf(1)}`;
    if (closed.has(key)) continue;
    closed.add(key);

    for (const box of node.boxes) {
      for (const step of statics.steps) {
        const stand = neighbourAt(statics, box, -step.dx, -step.dy);
        if (stand < 0 || !seen[stand]) continue;

        const dest = neighbourAt(statics, box, step.dx, step.dy);
        if (dest < 0 || statics.wall[dest] || boxAt[dest]) continue;
        if (pullDistance[dest] === Infinity) continue;

        boxAt[box] = 0;
        boxAt[dest] = 1;
        const frozen = isFrozen(statics, boxAt, dest);
        boxAt[box] = 1;
        boxAt[dest] = 0;
        if (frozen) continue;

        const boxes = node.boxes.map((i) => (i === box ? dest : i)).sort((a, b) => a - b);

        // The player ends up where the box was standing.
        const nextKey = `${boxes.join(',')}|${box}`;
        if (queued.has(nextKey)) continue;
        queued.add(nextKey);

        // Carry the opening push along the path instead of keeping parent pointers:
        // it is the only thing the caller ever asks for.
        const firstPush = node.firstPush ?? { box: toXY(statics, box), dir: step.dir };
        if (boxes.every((i) => statics.goal[i] === 1)) return firstPush;

        open.push({
          boxes,
          player: box,
          g: node.g + 1,
          f: node.g + 1 + WEIGHT * heuristic(boxes),
          firstPush,
        });
      }
    }
  }

  return null;
}
