import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLevel } from '../src/levels/levelValidator.js';
import { makeLevel } from './helpers.mjs';

test('a well-formed level reports no issues', () => {
  assert.deepEqual(validateLevel(makeLevel(['#####', '#@$.#', '#####'])), []);
});

test('an empty level is reported', () => {
  assert.equal(validateLevel(makeLevel([])).length, 1);
  assert.match(validateLevel({ name: 'x', width: 0, height: 0, rows: [] })[0], /Empty/);
});

test('a missing or extra player is caught', () => {
  assert.match(validateLevel(makeLevel(['#####', '# $.#', '#####']))[0], /exactly one player/);
  assert.match(validateLevel(makeLevel(['######', '#@$.@#', '######']))[0], /exactly one player/);
});

test('a box count differing from the goal count is caught', () => {
  const issues = validateLevel(makeLevel(['######', '#@$$.#', '######']));
  assert.equal(issues.length, 1);
  assert.match(issues[0], /Box count/);
});

test('a level with no boxes is caught', () => {
  assert.match(validateLevel(makeLevel(['#####', '#@  #', '#####']))[0], /no boxes/);
});

test('an open play area is caught', () => {
  // The right edge has no wall, so the player can walk off the grid.
  const issues = validateLevel(makeLevel(['#####', '#@$. ', '#####']));
  assert.ok(issues.some((m) => /not sealed/.test(m)));
});

test('a sealed play area is not reported as open', () => {
  const issues = validateLevel(makeLevel(['#####', '#@$.#', '#####']));
  assert.equal(issues.some((m) => /not sealed/.test(m)), false);
});
