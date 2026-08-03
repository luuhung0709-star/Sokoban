import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildStatics, buildPullDistance, neighbourAt, toXY, solveNextPush } from '../src/core/solver.js';
import { Direction } from '../src/core/direction.js';
import { parseBoxKey } from '../src/core/board.js';
import { makeBoard } from './helpers.mjs';

/** A Board is what the game has; a snapshot is what the solver takes. */
function snapshotOf(rows) {
  const board = makeBoard(rows);
  return {
    width: board.width,
    height: board.height,
    statics: board.statics,
    boxes: [...board.boxes].map(parseBoxKey),
    player: { ...board.player },
  };
}

const at = (statics, values, x, y) => values[y * statics.width + x];

test('buildStatics marks walls and goals in index space', () => {
  const statics = buildStatics(snapshotOf(['#####', '#@$.#', '#####']));

  assert.equal(statics.width, 5);
  assert.equal(statics.size, 15);
  assert.equal(at(statics, statics.wall, 0, 1), 1);
  assert.equal(at(statics, statics.wall, 2, 1), 0, 'the box sits on floor, not wall');
  assert.equal(at(statics, statics.goal, 3, 1), 1);
  assert.equal(at(statics, statics.goal, 2, 1), 0);
});

test('a goal is zero pulls from itself and its neighbours count up', () => {
  const statics = buildStatics(snapshotOf(['#####', '#@$.#', '#####']));
  const dist = buildPullDistance(statics);

  assert.equal(at(statics, dist, 3, 1), 0, 'the goal itself');
  assert.equal(at(statics, dist, 2, 1), 1, 'one push away');
});

test('a square no box can ever be pushed out of is Infinity', () => {
  // The goal is at (3,2). A box in the top-left corner (1,1) has walls above and to
  // its left, so it can never be pushed anywhere useful again.
  const statics = buildStatics(snapshotOf(['#####', '#$ @#', '#  .#', '#####']));
  const dist = buildPullDistance(statics);

  assert.equal(at(statics, dist, 3, 2), 0);
  assert.equal(at(statics, dist, 2, 2), 1);
  assert.equal(at(statics, dist, 1, 1), Infinity, 'the corner is a dead square');
});

test('walls are Infinity too, so nothing ever plans a push into one', () => {
  const statics = buildStatics(snapshotOf(['#####', '#@$.#', '#####']));
  const dist = buildPullDistance(statics);

  assert.equal(at(statics, dist, 0, 0), Infinity);
});

test('neighbourAt bounds-checks on x and y, not on flat index', () => {
  // On a 5-wide grid, stepping right off the last column of a row must return -1,
  // not wrap to the next row. A flat-index check (n < 0 || n >= size) would
  // incorrectly allow the wrap: index 4 + 1 = 5, which is valid.
  const statics = buildStatics(snapshotOf(['#####', '#@$.#', '#####']));

  // Index 9 is (4, 1) — the last column. Stepping right should go out of bounds.
  assert.equal(neighbourAt(statics, 9, 1, 0), -1, 'stepping right off the last column');

  // Index 5 is (0, 1) — the first column. Stepping left should go out of bounds.
  assert.equal(neighbourAt(statics, 5, -1, 0), -1, 'stepping left off column 0');

  // A normal in-grid step stays on the grid.
  assert.equal(neighbourAt(statics, 6, 1, 0), 7, 'stepping right within the grid');
});

test('toXY converts flat index back to coordinates', () => {
  // This test ensures toXY is the correct inverse of flat indexing.
  // Index 7 on a 5-wide grid should be (2, 1): y = 7 ÷ 5 = 1, x = 7 % 5 = 2.
  const statics = buildStatics(snapshotOf(['#####', '#@$.#', '#####']));

  const coord = toXY(statics, 7);
  assert.deepEqual(coord, { x: 2, y: 1 }, 'index 7 maps to (2, 1)');

  // Test another index to confirm round-trip: (3, 1) should be index 8.
  const index = 1 * 5 + 3;
  assert.equal(index, 8);
  const coord2 = toXY(statics, 8);
  assert.deepEqual(coord2, { x: 3, y: 1 }, 'index 8 maps to (3, 1)');
});

test('pulls reach all reachable squares via the shortest path', () => {
  // A grid with open interior space reveals non-minimal fill: if the algorithm
  // used LIFO (stack) instead of FIFO (queue), it would explore deeper before
  // shorter, and report wrong distances. This grid has a single goal at (1,1)
  // and an open interior where squares are reachable by multiple paths at the
  // same depth, and the algorithm must visit all of them at the correct distance.
  // A non-minimal fill would assign wrong distances when multiple paths exist.
  const statics = buildStatics(snapshotOf([
    '#########',
    '#.      #',
    '#       #',
    '#       #',
    '#       #',
    '#       #',
    '#       #',
    '#########',
  ]));
  const dist = buildPullDistance(statics);

  // (1, 1): goal, distance 0
  assert.equal(at(statics, dist, 1, 1), 0, 'goal itself is distance 0');

  // (1, 2): pulled up to (1,1), distance 1
  assert.equal(at(statics, dist, 1, 2), 1, 'one step down from goal');

  // (1, 3): pulled up to (1,2), distance 2
  assert.equal(at(statics, dist, 1, 3), 2, 'two steps down from goal');

  // (1, 4): pulled up to (1,3), distance 3
  assert.equal(at(statics, dist, 1, 4), 3, 'three steps down from goal');

  // (1, 5): pulled up to (1,4), distance 4
  assert.equal(at(statics, dist, 1, 5), 4, 'four steps down from goal');

  // (2, 1): pulled left to (1,1), distance 1
  assert.equal(at(statics, dist, 2, 1), 1, 'one step right from goal');

  // (2, 2): reachable via (1,2) pushed right or (2,1) pushed down, both distance 2
  assert.equal(at(statics, dist, 2, 2), 2, 'two routes converge at distance 2');

  // (2, 3): reachable from (1,3) pushed right or (2,2) pushed down, both distance 3
  assert.equal(at(statics, dist, 2, 3), 3, 'multiple paths to this square, all distance 3');

  // (3, 3): reachable via (2,3) pushed right or (3,2) pushed down, distance 4
  assert.equal(at(statics, dist, 3, 3), 4, 'diagonal square is distance 4');
});

test('dead squares are distinguished from reachable ones, not just counted as Infinity', () => {
  // This test uses interior walls to create both reachable and dead squares.
  // A dead square is one where every direction either hits a wall, goes out of
  // bounds, or has a wall at the behind-square where the player would stand.
  // A reachable square can be pulled toward the goal in at least one direction.
  // If behind-square checking is dropped, the algorithm over-prunes and might
  // incorrectly mark reachable squares as dead.
  const statics = buildStatics(snapshotOf([
    '#########',
    '#.      #',
    '#    #  #',
    '#    # ##',
    '#########',
  ]));
  const dist = buildPullDistance(statics);

  // The goal is at (1, 1).
  assert.equal(at(statics, dist, 1, 1), 0, 'goal is distance 0');

  // Interior left chamber: all reachable.
  assert.equal(at(statics, dist, 2, 2), 2, 'interior square at (2, 2) is reachable');
  assert.equal(at(statics, dist, 4, 2), 4, 'interior square at (4, 2) is reachable');

  // Right side: one column of live squares, one column of dead.
  // (6, 1) is alive: a box there is pushed LEFT onto (5, 1), one step nearer the goal,
  // with the player standing at (7, 1).
  assert.equal(at(statics, dist, 6, 1), 5, 'live column: (6,1) is reachable');

  // (6, 2) is alive: a box there is pushed UP onto (6, 1), with the player standing at
  // (6, 3) — floor, though the row string makes it easy to misread as wall.
  assert.equal(at(statics, dist, 6, 2), 6, 'live column: (6,2) is reachable');

  // (7, 1) is dead: the only direction it could be pulled from is right, which would
  // require the player standing at (8,1). But (8,1) is a wall, so the pull is impossible.
  assert.equal(at(statics, dist, 7, 1), Infinity, 'dead column: (7,1) unreachable');

  // (7, 2) is dead. Its only live neighbour is (6, 2) to the LEFT, and a box on (7, 2)
  // could only reach it by being pushed left — which needs the player standing on (8, 2),
  // a wall. Nothing else helps: (7, 1) above is itself dead, and (7, 3) below is wall.
  assert.equal(at(statics, dist, 7, 2), Infinity, 'dead column: (7,2) unreachable');

  // This test pins the contrast: an over-pruning bug that wrongly marks the live column
  // (6,1) and (6,2) as dead would fail these new assertions, while the original test
  // would still pass (it only checked the dead side).
});

/** Node budget is deterministic; a wall-clock budget is not, so tests never use one. */
const NO_CLOCK = { maxMs: Infinity };

test('a one-push level names the box and the direction', () => {
  const hint = solveNextPush(snapshotOf(['#####', '#@$.#', '#####']), NO_CLOCK);

  assert.deepEqual(hint, { box: { x: 2, y: 1 }, dir: Direction.Right });
});

test('the hint names the push, and says nothing about the walk to reach it', () => {
  // The player is four squares away and has to walk round to get below the box. The
  // answer is still only "push this box up" — finding the way there is the player's job.
  const hint = solveNextPush(snapshotOf([
    '#######',
    '# .   #',
    '# $   #',
    '#    @#',
    '#######',
  ]), NO_CLOCK);

  assert.deepEqual(hint, { box: { x: 2, y: 2 }, dir: Direction.Up });
});

test('an already solved board has nothing to hint', () => {
  assert.equal(solveNextPush(snapshotOf(['####', '#@*#', '####']), NO_CLOCK), null);
});

test('a box pushed into a dead corner gives up rather than guessing', () => {
  assert.equal(solveNextPush(snapshotOf(['#####', '#$ @#', '#  .#', '#####']), NO_CLOCK), null);
});

test('running out of nodes returns null instead of throwing', () => {
  const hint = solveNextPush(
    snapshotOf(['#######', '#@$  .#', '#######']),
    { maxNodes: 1, maxMs: Infinity },
  );

  assert.equal(hint, null);
});

test('boxes standing side by side do not read as frozen', () => {
  // Two boxes touching, and the solution moves one of them past the other. A prune that
  // treated "a box beside me" as a permanent block would throw this position away.
  const hint = solveNextPush(snapshotOf([
    '#######',
    '#..   #',
    '# $$@ #',
    '#     #',
    '#######',
  ]), NO_CLOCK);

  assert.notEqual(hint, null, 'this position has a solution and the solver must find it');
});

test('the solver clears the opening position of the first 20 Microban levels', () => {
  const collection = JSON.parse(
    readFileSync(fileURLToPath(new URL('../src/levels/microban.json', import.meta.url)), 'utf8'),
  );

  for (const level of collection.levels.slice(0, 20)) {
    const hint = solveNextPush(snapshotOf(level.rows), { maxNodes: 50_000, maxMs: Infinity });
    assert.notEqual(hint, null, `level ${level.name} has a solution but the solver found none`);
  }
});
