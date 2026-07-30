import test from 'node:test';
import assert from 'node:assert/strict';
import { Board, CellType, boxKey, parseBoxKey } from '../src/core/board.js';
import { makeBoard } from './helpers.mjs';

test('fromLevel đọc đúng tường, nền và ô đích', () => {
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

test('ô ngoài lưới coi như tường', () => {
  const board = makeBoard(['@']);
  assert.equal(board.cellAt(-1, 0), CellType.Wall);
  assert.equal(board.cellAt(0, -1), CellType.Wall);
  assert.equal(board.cellAt(1, 0), CellType.Wall);
  assert.equal(board.cellAt(0, 1), CellType.Wall);
});

test('người chơi trên đích vừa đặt vị trí người vừa là ô đích', () => {
  const board = makeBoard(['+']);
  assert.deepEqual(board.player, { x: 0, y: 0 });
  assert.equal(board.cellAt(0, 0), CellType.Goal);
});

test('hộp trên đích vừa vào tập hộp vừa là ô đích', () => {
  const board = makeBoard(['*']);
  assert.equal(board.hasBox(0, 0), true);
  assert.equal(board.cellAt(0, 0), CellType.Goal);
});

test('isSolved đúng khi mọi hộp nằm trên đích', () => {
  assert.equal(makeBoard(['#####', '#@ *#', '#####']).isSolved, true);
  assert.equal(makeBoard(['#####', '#@ $#', '#####']).isSolved, false);
});

test('màn không có hộp nào thì coi như đã giải', () => {
  assert.equal(makeBoard(['#####', '#@  #', '#####']).isSolved, true);
});

test('hàng ngắn hơn width được coi là nền trống', () => {
  const board = Board.fromLevel({ name: 't', width: 4, height: 1, rows: ['#@'] });
  assert.equal(board.cellAt(3, 0), CellType.Floor);
});

test('boxKey và parseBoxKey đi ngược nhau', () => {
  assert.equal(boxKey(3, 7), '3,7');
  assert.deepEqual(parseBoxKey('3,7'), { x: 3, y: 7 });
});
