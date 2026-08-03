import test from 'node:test';
import assert from 'node:assert/strict';
import { MoveHistory } from '../src/core/moveHistory.js';

const fakeMove = (id) => ({ id });

test('an empty history cannot undo', () => {
  const history = new MoveHistory();
  assert.equal(history.canUndo, false);
});

test('undo returns the moves back to front', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.record(fakeMove(2));

  assert.deepEqual(history.popForUndo(), fakeMove(2));
  assert.deepEqual(history.popForUndo(), fakeMove(1));
  assert.equal(history.canUndo, false);
});

test('an undone move is gone for good — there is no redo branch', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.popForUndo();

  assert.equal(history.canUndo, false);
  // `in` walks the prototype chain, so this catches a leftover getter. Object.hasOwn
  // would not: getters live on the prototype, so it reads false either way and the
  // assertion would pass against the old class too.
  assert.equal('canRedo' in history, false, 'no redo surface should remain');
});

test('clear empties the history', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.record(fakeMove(2));

  history.clear();
  assert.equal(history.canUndo, false);
});
