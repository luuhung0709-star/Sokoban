import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction, toDelta } from '../src/core/direction.js';

test('mỗi hướng cho ra đúng một vector đơn vị', () => {
  assert.deepEqual(toDelta(Direction.Up), { dx: 0, dy: -1 });
  assert.deepEqual(toDelta(Direction.Down), { dx: 0, dy: 1 });
  assert.deepEqual(toDelta(Direction.Left), { dx: -1, dy: 0 });
  assert.deepEqual(toDelta(Direction.Right), { dx: 1, dy: 0 });
});

test('hướng lạ thì ném lỗi thay vì trả về undefined', () => {
  assert.throws(() => toDelta('Sideways'), /Sideways/);
});
