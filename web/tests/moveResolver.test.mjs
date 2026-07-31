import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { resolve, apply, revert } from '../src/core/moveResolver.js';
import { makeBoard } from './helpers.mjs';

test('walking onto an empty square is an ordinary move', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.blocked, false);
  assert.equal(move.push, false);
  assert.deepEqual(move.from, { x: 1, y: 1 });
  assert.deepEqual(move.to, { x: 2, y: 1 });
  assert.equal(move.boxFrom, null);
});

test('walking into a wall is blocked and moves nothing', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Left);

  assert.equal(move.blocked, true);
  assert.deepEqual(move.to, move.from);
});

test('pushing a box onto an empty square is a push move', () => {
  const board = makeBoard(['#####', '#@$ #', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.blocked, false);
  assert.equal(move.push, true);
  assert.deepEqual(move.to, { x: 2, y: 1 });
  assert.deepEqual(move.boxFrom, { x: 2, y: 1 });
  assert.deepEqual(move.boxTo, { x: 3, y: 1 });
});

test('pushing a box into a wall is blocked', () => {
  const board = makeBoard(['####', '#@$#', '####']);
  assert.equal(resolve(board, Direction.Right).blocked, true);
});

test('two boxes in a row cannot be pushed', () => {
  const board = makeBoard(['######', '#@$$ #', '######']);
  assert.equal(resolve(board, Direction.Right).blocked, true);
});

test('a box can be pushed onto a goal', () => {
  const board = makeBoard(['#####', '#@$.#', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.push, true);
  apply(board, move);
  assert.equal(board.isSolved, true);
});

test('resolve does not modify the board', () => {
  const board = makeBoard(['#####', '#@$ #', '#####']);
  resolve(board, Direction.Right);

  assert.deepEqual(board.player, { x: 1, y: 1 });
  assert.equal(board.hasBox(2, 1), true);
});

test('apply then revert returns the exact previous state', () => {
  const board = makeBoard(['#####', '#@$ #', '#####']);
  const move = resolve(board, Direction.Right);

  apply(board, move);
  assert.deepEqual(board.player, { x: 2, y: 1 });
  assert.equal(board.hasBox(3, 1), true);
  assert.equal(board.hasBox(2, 1), false);

  revert(board, move);
  assert.deepEqual(board.player, { x: 1, y: 1 });
  assert.equal(board.hasBox(2, 1), true);
  assert.equal(board.hasBox(3, 1), false);
});

test('apply and revert ignore a blocked move', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Left);

  apply(board, move);
  assert.deepEqual(board.player, { x: 1, y: 1 });
  revert(board, move);
  assert.deepEqual(board.player, { x: 1, y: 1 });
});

test('pushing a box off its goal loses the solved state', () => {
  const board = makeBoard(['######', '#@*  #', '######']);
  assert.equal(board.isSolved, true);   // the only box currently sits on a goal

  const move = resolve(board, Direction.Right);
  apply(board, move);

  assert.equal(board.hasBox(3, 1), true);
  // Solved state is recomputed from the board rather than counted up and down, so it drops at once.
  assert.equal(board.isSolved, false);
});
