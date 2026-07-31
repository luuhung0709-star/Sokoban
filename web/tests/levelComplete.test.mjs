import test from 'node:test';
import assert from 'node:assert/strict';
import { LevelComplete } from '../src/ui/levelComplete.js';
import { makeElement, withId } from './fakeDom.mjs';

function setup() {
  const root = makeElement('div');
  for (const id of ['complete-stats', 'complete-best', 'btn-next', 'btn-retry', 'btn-to-levels']) {
    root.append(withId(id, 'button'));
  }

  const fired = [];
  const panel = new LevelComplete(root, {
    onNext: () => fired.push('next'),
    onRetry: () => fired.push('retry'),
    onSelect: () => fired.push('select'),
  });

  return { root, panel, fired, el: (id) => root.querySelector(`#${id}`) };
}

test('show prints the move and push counts', () => {
  const { panel, el } = setup();

  panel.show({ moves: 33, pushes: 9, bestMoves: 0, hasNext: true });

  assert.equal(el('complete-stats').textContent, '33 moves · 9 pushes');
});

test('a first clear reads as a new best', () => {
  const { panel, el } = setup();

  // bestMoves 0 is what GameFlow passes when there is no previous record.
  panel.show({ moves: 33, pushes: 9, bestMoves: 0, hasNext: true });

  assert.equal(el('complete-best').textContent, 'New best!');
});

test('beating the stored record reads as a new best', () => {
  const { panel, el } = setup();

  panel.show({ moves: 30, pushes: 8, bestMoves: 33, hasNext: true });

  assert.equal(el('complete-best').textContent, 'New best!');
});

test('a slower run shows the record instead of claiming a new best', () => {
  const { panel, el } = setup();

  panel.show({ moves: 40, pushes: 12, bestMoves: 33, hasNext: true });

  assert.equal(el('complete-best').textContent, 'Your best: 33 moves');
});

test('matching the record exactly is not announced as a new best', () => {
  const { panel, el } = setup();

  panel.show({ moves: 33, pushes: 9, bestMoves: 33, hasNext: true });

  assert.equal(el('complete-best').textContent, 'Your best: 33 moves');
});

test('the last level hides Next and congratulates instead', () => {
  const { panel, el } = setup();

  panel.show({ moves: 12, pushes: 3, bestMoves: 0, hasNext: false });

  assert.equal(el('btn-next').hidden, true);
  assert.match(el('complete-stats').textContent, /last level/);
});

test('a level with a successor keeps Next visible and adds no congratulations', () => {
  const { panel, el } = setup();

  panel.show({ moves: 12, pushes: 3, bestMoves: 0, hasNext: true });

  assert.equal(el('btn-next').hidden, false);
  assert.equal(el('complete-stats').textContent, '12 moves · 3 pushes');
});

test('show reveals the overlay and hide puts it away', () => {
  const { root, panel } = setup();

  panel.show({ moves: 1, pushes: 0, bestMoves: 0, hasNext: true });
  assert.equal(root.hidden, false);

  panel.hide();
  assert.equal(root.hidden, true);
});

test('each button fires its own callback', () => {
  const { panel, fired, el } = setup();
  panel.show({ moves: 1, pushes: 0, bestMoves: 0, hasNext: true });

  el('btn-next').dispatch('click');
  el('btn-retry').dispatch('click');
  el('btn-to-levels').dispatch('click');

  assert.deepEqual(fired, ['next', 'retry', 'select']);
});

test('showing twice does not accumulate the congratulations line', () => {
  const { panel, el } = setup();

  panel.show({ moves: 12, pushes: 3, bestMoves: 0, hasNext: false });
  panel.show({ moves: 12, pushes: 3, bestMoves: 0, hasNext: false });

  const occurrences = el('complete-stats').textContent.match(/last level/g) ?? [];
  assert.equal(occurrences.length, 1, 'the stats line is rewritten each time, not appended to');
});
