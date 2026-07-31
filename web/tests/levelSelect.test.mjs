import test from 'node:test';
import assert from 'node:assert/strict';
import { LevelSelect } from '../src/ui/levelSelect.js';
import { ProgressStore } from '../src/progress/progressStore.js';
import { makeElement, withId, installDocument } from './fakeDom.mjs';

installDocument();

const COLLECTION = 'Microban';

/** The real store on an in-memory storage — the unlock rule is what is under test. */
function makeProgress() {
  const data = new Map();
  return new ProgressStore({
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  });
}

const levels = (count) =>
  Array.from({ length: count }, (_, i) => ({ name: String(i + 1), width: 3, height: 3, rows: [] }));

function setup() {
  const root = makeElement('div');
  root.append(withId('levels', 'div'), withId('btn-levels-back', 'button'));

  const picked = [];
  const back = [];
  const panel = new LevelSelect(root, {
    onPick: (index) => picked.push(index),
    onBack: () => back.push(true),
  });

  return { root, panel, picked, back, grid: root.querySelector('#levels') };
}

test('renders one button per level', () => {
  const { panel, grid } = setup();

  panel.render(levels(5), makeProgress(), COLLECTION);

  assert.equal(grid.children.length, 5);
});

test('only the first level is unlocked on a fresh save', () => {
  const { panel, grid } = setup();

  panel.render(levels(3), makeProgress(), COLLECTION);

  assert.equal(grid.children[0].disabled, false);
  assert.equal(grid.children[1].disabled, true);
  assert.equal(grid.children[2].disabled, true);
});

test('clearing a level unlocks exactly the next one', () => {
  const { panel, grid } = setup();
  const progress = makeProgress();
  progress.recordCompletion(COLLECTION, 0, 33, 9);

  panel.render(levels(3), progress, COLLECTION);

  assert.equal(grid.children[1].disabled, false, 'level 2 opens');
  assert.equal(grid.children[2].disabled, true, 'level 3 stays shut');
});

test('a cleared level is ticked and shows its best move count', () => {
  const { panel, grid } = setup();
  const progress = makeProgress();
  progress.recordCompletion(COLLECTION, 0, 33, 9);

  panel.render(levels(2), progress, COLLECTION);

  const [num, best] = grid.children[0].children;
  assert.equal(num.textContent, '✓ 1');
  assert.equal(best.textContent, '33 moves');
  assert.match(grid.children[0].className, /level-btn--done/);
});

test('an unplayed level shows a bare name and no score', () => {
  const { panel, grid } = setup();

  panel.render(levels(2), makeProgress(), COLLECTION);

  const [num, best] = grid.children[0].children;
  assert.equal(num.textContent, '1');
  assert.equal(best.textContent, '');
});

test('the button label comes from the level name, not its index', () => {
  const { panel, grid } = setup();
  const named = [{ name: 'warm-up', width: 3, height: 3, rows: [] }];

  panel.render(named, makeProgress(), COLLECTION);

  assert.equal(grid.children[0].children[0].textContent, 'warm-up');
});

test('clicking a button reports that index', () => {
  const { panel, picked, grid } = setup();
  panel.render(levels(3), makeProgress(), COLLECTION);

  grid.children[0].dispatch('click');

  assert.deepEqual(picked, [0]);
});

test('an empty collection shows a message instead of a blank grid', () => {
  const { panel, grid } = setup();

  panel.render([], makeProgress(), COLLECTION);

  assert.equal(grid.children.length, 1);
  assert.equal(grid.children[0].className, 'empty');
  assert.match(grid.children[0].textContent, /empty/i);
});

test('re-rendering replaces the grid rather than appending to it', () => {
  const { panel, grid } = setup();

  panel.render(levels(3), makeProgress(), COLLECTION);
  panel.render(levels(2), makeProgress(), COLLECTION);

  assert.equal(grid.children.length, 2);
});

test('the back button fires its callback', () => {
  const { root, back } = setup();

  root.querySelector('#btn-levels-back').dispatch('click');

  assert.deepEqual(back, [true]);
});
