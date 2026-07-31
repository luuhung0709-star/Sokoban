import test from 'node:test';
import assert from 'node:assert/strict';
import { MoveHistory } from '../src/core/moveHistory.js';

const fakeMove = (id) => ({ id });

test('an empty history can neither undo nor redo', () => {
  const history = new MoveHistory();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});

test('undo returns the last move and opens the way for redo', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.record(fakeMove(2));

  assert.deepEqual(history.popForUndo(), fakeMove(2));
  assert.equal(history.canRedo, true);
  assert.deepEqual(history.popForRedo(), fakeMove(2));
  assert.equal(history.canRedo, false);
});

test('recording a new move clears the redo branch', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.popForUndo();
  assert.equal(history.canRedo, true);

  history.record(fakeMove(2));
  assert.equal(history.canRedo, false);
});

test('clear empties both branches', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.popForUndo();
  history.record(fakeMove(2));

  history.clear();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});
