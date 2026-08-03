import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatics, buildPullDistance } from '../src/core/solver.js';
import { makeBoard } from './helpers.mjs';

/** A Board is what the game has; a snapshot is what the solver takes. */
function snapshotOf(rows) {
  const board = makeBoard(rows);
  return {
    width: board.width,
    height: board.height,
    statics: board.statics,
    boxes: [...board.boxes].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }),
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
