import test from 'node:test';
import assert from 'node:assert/strict';
import { isGrid, isContent, countPieces } from '../src/levels/sokobanChars.js';

test('isGrid accepts exactly the seven grid characters', () => {
  for (const c of ['#', ' ', '@', '+', '$', '*', '.']) {
    assert.equal(isGrid(c), true, `${JSON.stringify(c)} should be a grid character`);
  }
});

test('isGrid rejects letters, digits and stray characters', () => {
  for (const c of ['a', 'T', '1', ':', '\t']) {
    assert.equal(isGrid(c), false, `${JSON.stringify(c)} is not a grid character`);
  }
});

test('isContent excludes empty floor from the grid characters', () => {
  assert.equal(isContent(' '), false);
  assert.equal(isContent('#'), true);
  assert.equal(isContent('.'), true);
  assert.equal(isContent('a'), false);
});

test('countPieces counts players, boxes and goals correctly', () => {
  const counts = countPieces(['#####', '#@$.#', '#####']);
  assert.equal(counts.players, 1);
  assert.equal(counts.boxes, 1);
  assert.equal(counts.goals, 1);
  assert.deepEqual(counts.playerPos, { x: 1, y: 1 });
});

test('countPieces counts * and + on both sides', () => {
  // '*' is both a box and a goal; '+' is both the player and a goal.
  const counts = countPieces(['#+*#']);
  assert.equal(counts.players, 1);
  assert.equal(counts.boxes, 1);
  assert.equal(counts.goals, 2);
  assert.deepEqual(counts.playerPos, { x: 1, y: 0 });
});

test('countPieces returns a null playerPos on a grid with no player', () => {
  assert.equal(countPieces(['####']).playerPos, null);
});
