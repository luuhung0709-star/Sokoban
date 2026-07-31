import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMicroban } from '../src/levels/parseMicroban.js';

test('reads a level whose title sits after the grid', () => {
  const { levels, errors } = parseMicroban([
    '#####',
    '#@$.#',
    '#####',
    'Title: 7',
  ].join('\n'));

  assert.deepEqual(errors, []);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].name, '7');
  assert.equal(levels[0].width, 5);
  assert.equal(levels[0].height, 3);
});

test('pads short rows out to the longest row', () => {
  const { levels } = parseMicroban(['####', '#@$.###', '####'].join('\n'));

  assert.equal(levels[0].width, 7);
  assert.deepEqual(levels[0].rows, ['####   ', '#@$.###', '####   ']);
});

test('skips the header block because it has no grid rows', () => {
  const { levels, errors } = parseMicroban([
    'Title: Microban',
    'Description: a set of small levels',
    '             continued on the next line',
    'Author: David W Skinner',
    '',
    '#####',
    '#@$.#',
    '#####',
    'Title: 1',
  ].join('\n'));

  assert.deepEqual(errors, []);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].name, '1');
});

test('reads all 7 characters', () => {
  // 3 boxes ($ $ *) and 3 goals (. * +) — they must balance, or the parser errors.
  const { levels, errors } = parseMicroban(['#+*$$.#', 'Title: x'].join('\n'));

  assert.deepEqual(errors, []);
  assert.deepEqual(levels[0].rows, ['#+*$$.#']);
});

test('several levels separated by a blank line', () => {
  const { levels } = parseMicroban([
    '#####', '#@$.#', '#####', 'Title: 1',
    '',
    '#####', '#@$.#', '#####', 'Title: 2',
  ].join('\n'));

  assert.equal(levels.length, 2);
  assert.deepEqual(levels.map((l) => l.name), ['1', '2']);
});

test('a level without exactly one player errors with a line number and is skipped', () => {
  const { levels, errors } = parseMicroban([
    '',
    '#####',
    '#@$@#',
    '#####',
  ].join('\n'));

  assert.equal(levels.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Line 2/);
  assert.match(errors[0], /2/);
});

test('a box count differing from the goal count errors', () => {
  const { errors } = parseMicroban(['#####', '#@$ #', '#####'].join('\n'));

  assert.equal(errors.length, 1);
  assert.match(errors[0], /1 box/);
});

test('one broken level does not break the rest', () => {
  const { levels, errors } = parseMicroban([
    '#####', '#@$@#', '#####',
    '',
    '#####', '#@$.#', '#####', 'Title: good',
  ].join('\n'));

  assert.equal(errors.length, 1);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].name, 'good');
});

test('a level without a title is named after its position', () => {
  const { levels } = parseMicroban(['#####', '#@$.#', '#####'].join('\n'));
  assert.equal(levels[0].name, 'Level 1');
});

test('an empty string gives an empty result, not an error', () => {
  assert.deepEqual(parseMicroban(''), { levels: [], errors: [] });
});

test('Windows line endings read as normal', () => {
  const { levels } = parseMicroban('#####\r\n#@$.#\r\n#####\r\nTitle: 1');
  assert.equal(levels.length, 1);
  assert.equal(levels[0].width, 5);
});
