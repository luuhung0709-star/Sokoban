import test from 'node:test';
import assert from 'node:assert/strict';
import { Board, CellType, boxKey, parseBoxKey } from '../src/core/board.js';
import { makeBoard } from './helpers.mjs';

test('fromLevel reads walls, floor and goal cells correctly', () => {
  const board = makeBoard([
    '###',
    '#.#',
    '###',
  ]);
  assert.equal(board.cellAt(0, 0), CellType.Wall);
  assert.equal(board.cellAt(1, 1), CellType.Goal);
  assert.equal(board.width, 3);
  assert.equal(board.height, 3);
});

test('cells outside the grid count as wall', () => {
  const board = makeBoard(['@']);
  assert.equal(board.cellAt(-1, 0), CellType.Wall);
  assert.equal(board.cellAt(0, -1), CellType.Wall);
  assert.equal(board.cellAt(1, 0), CellType.Wall);
  assert.equal(board.cellAt(0, 1), CellType.Wall);
});

test('a player on a goal sets the player position and keeps the goal cell', () => {
  const board = makeBoard(['+']);
  assert.deepEqual(board.player, { x: 0, y: 0 });
  assert.equal(board.cellAt(0, 0), CellType.Goal);
});

test('a box on a goal joins the box set and keeps the goal cell', () => {
  const board = makeBoard(['*']);
  assert.equal(board.hasBox(0, 0), true);
  assert.equal(board.cellAt(0, 0), CellType.Goal);
});

test('isSolved is true once every box sits on a goal', () => {
  assert.equal(makeBoard(['#####', '#@ *#', '#####']).isSolved, true);
  assert.equal(makeBoard(['#####', '#@ $#', '#####']).isSolved, false);
});

test('a level with no boxes counts as solved', () => {
  assert.equal(makeBoard(['#####', '#@  #', '#####']).isSolved, true);
});

test('rows shorter than width are treated as empty floor', () => {
  const board = Board.fromLevel({ name: 't', width: 4, height: 1, rows: ['#@'] });
  assert.equal(board.cellAt(3, 0), CellType.Floor);
});

test('boxKey and parseBoxKey are inverses', () => {
  assert.equal(boxKey(3, 7), '3,7');
  assert.deepEqual(parseBoxKey('3,7'), { x: 3, y: 7 });
});
