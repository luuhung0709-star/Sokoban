import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { makeLevel } from './helpers.mjs';

const level = () => makeLevel(['#######', '#@$ . #', '#######'], 'test');

test('one move increments the move counter', () => {
  const session = new GameSession(level());
  assert.equal(session.tryMove(Direction.Right).push, true);
  assert.equal(session.moves, 1);
  assert.equal(session.pushes, 1);
});

test('a blocked move does not count and returns null', () => {
  const session = new GameSession(level());
  assert.equal(session.tryMove(Direction.Left), null);
  assert.equal(session.moves, 0);
});

test('undo restores the counters and the board to the previous state', () => {
  const session = new GameSession(level());
  session.tryMove(Direction.Right);

  assert.ok(session.tryUndo());
  assert.equal(session.moves, 0);
  assert.equal(session.pushes, 0);
  assert.deepEqual(session.board.player, { x: 1, y: 1 });
  assert.equal(session.board.hasBox(2, 1), true);
});

test('undoing everything matches the level start state', () => {
  const session = new GameSession(level());
  const start = new GameSession(level());

  session.tryMove(Direction.Right);
  session.tryMove(Direction.Right);
  while (session.canUndo) session.tryUndo();

  assert.deepEqual(session.board.player, start.board.player);
  assert.deepEqual([...session.board.boxes].sort(), [...start.board.boxes].sort());
  assert.equal(session.moves, 0);
});

test('redo replays exactly the move just undone', () => {
  const session = new GameSession(level());
  session.tryMove(Direction.Right);
  session.tryUndo();

  assert.ok(session.tryRedo());
  assert.equal(session.moves, 1);
  assert.deepEqual(session.board.player, { x: 2, y: 1 });
});

test('a new move clears the redo branch', () => {
  const session = new GameSession(level());
  session.tryMove(Direction.Right);
  session.tryUndo();
  assert.equal(session.canRedo, true);

  session.tryMove(Direction.Right);
  assert.equal(session.canRedo, false);
});

test('restart rebuilds the board and clears the history', () => {
  const session = new GameSession(level());
  session.tryMove(Direction.Right);
  session.restart();

  assert.equal(session.moves, 0);
  assert.equal(session.canUndo, false);
  assert.deepEqual(session.board.player, { x: 1, y: 1 });
  assert.equal(session.board.hasBox(2, 1), true);
});

test('onChange fires on every state change and can be unsubscribed', () => {
  const session = new GameSession(level());
  let count = 0;
  const off = session.onChange(() => { count++; });

  session.tryMove(Direction.Right);
  session.tryUndo();
  assert.equal(count, 2);

  off();
  session.tryMove(Direction.Right);
  assert.equal(count, 2);
});

test('a blocked move fires no event', () => {
  const session = new GameSession(level());
  let count = 0;
  session.onChange(() => { count++; });

  session.tryMove(Direction.Left);
  assert.equal(count, 0);
});
