import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { resolve, apply, revert } from '../src/core/moveResolver.js';
import { makeBoard } from './helpers.mjs';

test('đi vào ô trống là nước đi thường', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.blocked, false);
  assert.equal(move.push, false);
  assert.deepEqual(move.from, { x: 1, y: 1 });
  assert.deepEqual(move.to, { x: 2, y: 1 });
  assert.equal(move.boxFrom, null);
});

test('đi vào tường thì bị chặn và không nhúc nhích', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Left);

  assert.equal(move.blocked, true);
  assert.deepEqual(move.to, move.from);
});

test('đẩy hộp vào ô trống là nước đẩy', () => {
  const board = makeBoard(['#####', '#@$ #', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.blocked, false);
  assert.equal(move.push, true);
  assert.deepEqual(move.to, { x: 2, y: 1 });
  assert.deepEqual(move.boxFrom, { x: 2, y: 1 });
  assert.deepEqual(move.boxTo, { x: 3, y: 1 });
});

test('đẩy hộp vào tường thì bị chặn', () => {
  const board = makeBoard(['####', '#@$#', '####']);
  assert.equal(resolve(board, Direction.Right).blocked, true);
});

test('không đẩy được hai hộp liền nhau', () => {
  const board = makeBoard(['######', '#@$$ #', '######']);
  assert.equal(resolve(board, Direction.Right).blocked, true);
});

test('đẩy được hộp lên ô đích', () => {
  const board = makeBoard(['#####', '#@$.#', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.push, true);
  apply(board, move);
  assert.equal(board.isSolved, true);
});

test('resolve không đổi board', () => {
  const board = makeBoard(['#####', '#@$ #', '#####']);
  resolve(board, Direction.Right);

  assert.deepEqual(board.player, { x: 1, y: 1 });
  assert.equal(board.hasBox(2, 1), true);
});

test('apply rồi revert quay về đúng trạng thái cũ', () => {
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

test('apply và revert bỏ qua nước bị chặn', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Left);

  apply(board, move);
  assert.deepEqual(board.player, { x: 1, y: 1 });
  revert(board, move);
  assert.deepEqual(board.player, { x: 1, y: 1 });
});

test('đẩy hộp đang đúng đích ra ngoài thì mất trạng thái thắng', () => {
  const board = makeBoard(['######', '#@*  #', '######']);
  assert.equal(board.isSolved, true);   // hộp duy nhất đang nằm trên đích

  const move = resolve(board, Direction.Right);
  apply(board, move);

  assert.equal(board.hasBox(3, 1), true);
  // Trạng thái thắng tính lại từ bàn cờ chứ không đếm tăng giảm, nên nó mất ngay.
  assert.equal(board.isSolved, false);
});
