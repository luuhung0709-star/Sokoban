import test from 'node:test';
import assert from 'node:assert/strict';
import { MoveHistory } from '../src/core/moveHistory.js';

const fakeMove = (id) => ({ id });

test('lịch sử rỗng thì không undo cũng không redo được', () => {
  const history = new MoveHistory();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});

test('undo trả về nước cuối cùng và mở đường cho redo', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.record(fakeMove(2));

  assert.deepEqual(history.popForUndo(), fakeMove(2));
  assert.equal(history.canRedo, true);
  assert.deepEqual(history.popForRedo(), fakeMove(2));
  assert.equal(history.canRedo, false);
});

test('ghi nước mới thì xoá sạch nhánh redo', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.popForUndo();
  assert.equal(history.canRedo, true);

  history.record(fakeMove(2));
  assert.equal(history.canRedo, false);
});

test('clear xoá cả hai nhánh', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.popForUndo();
  history.record(fakeMove(2));

  history.clear();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});
