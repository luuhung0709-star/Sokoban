import test from 'node:test';
import assert from 'node:assert/strict';
import { BoardRenderer } from '../src/view/boardRenderer.js';
import { Direction } from '../src/core/direction.js';
import { makeBoard } from './helpers.mjs';
import { installDocument, makeElement } from './fakeDom.mjs';

installDocument();

/** A board with the player at (1,1) and a box at (2,1). */
function setup() {
  const root = makeElement('div');
  const renderer = new BoardRenderer(root);
  const board = makeBoard(['#####', '#@$.#', '#####']);
  renderer.build(board);
  return { renderer, board };
}

test('showHint marks the named box and hangs an arrow on it', () => {
  const { renderer } = setup();

  renderer.showHint({ x: 2, y: 1 }, Direction.Right);

  const box = renderer.boxElAt(2, 1);
  assert.equal(box.classList.contains('actor--hint'), true);
  assert.notEqual(box.querySelector('.actor__hint-arrow'), null);
});

test('the arrow carries the rotation for its direction', () => {
  const { renderer } = setup();

  renderer.showHint({ x: 2, y: 1 }, Direction.Left);

  const arrow = renderer.boxElAt(2, 1).querySelector('.actor__hint-arrow');
  assert.equal(arrow.style['--hint-rot'], '270deg');
});

test('clearHint takes the mark and the arrow back off', () => {
  const { renderer } = setup();
  renderer.showHint({ x: 2, y: 1 }, Direction.Right);

  renderer.clearHint();

  const box = renderer.boxElAt(2, 1);
  assert.equal(box.classList.contains('actor--hint'), false);
  assert.equal(box.querySelector('.actor__hint-arrow'), null, 'a stale arrow would stack up');
});

test('a second hint replaces the first rather than adding to it', () => {
  const { renderer } = setup();

  renderer.showHint({ x: 2, y: 1 }, Direction.Right);
  renderer.showHint({ x: 2, y: 1 }, Direction.Up);

  const box = renderer.boxElAt(2, 1);
  assert.equal(box.querySelectorAll('.actor__hint-arrow').length, 1);
});

test('clearHint on a board with no hint showing is harmless', () => {
  const { renderer } = setup();

  assert.doesNotThrow(() => renderer.clearHint());
});

test('a hint aimed at a square with no box is ignored, not crashed on', () => {
  const { renderer } = setup();

  assert.doesNotThrow(() => renderer.showHint({ x: 3, y: 1 }, Direction.Right));
});

test('rebuilding for a new level forgets the old hint', () => {
  const { renderer } = setup();
  renderer.showHint({ x: 2, y: 1 }, Direction.Right);

  renderer.build(makeBoard(['#####', '#@$.#', '#####']));

  // The old element is gone; clearHint must not reach back into it.
  assert.doesNotThrow(() => renderer.clearHint());
  assert.equal(renderer.boxElAt(2, 1).classList.contains('actor--hint'), false);
});
