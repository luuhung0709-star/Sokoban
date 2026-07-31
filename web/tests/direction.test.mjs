import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction, toDelta } from '../src/core/direction.js';

test('each direction yields exactly one unit vector', () => {
  assert.deepEqual(toDelta(Direction.Up), { dx: 0, dy: -1 });
  assert.deepEqual(toDelta(Direction.Down), { dx: 0, dy: 1 });
  assert.deepEqual(toDelta(Direction.Left), { dx: -1, dy: 0 });
  assert.deepEqual(toDelta(Direction.Right), { dx: 1, dy: 0 });
});

test('an unknown direction throws instead of returning undefined', () => {
  assert.throws(() => toDelta('Sideways'), /Sideways/);
});
