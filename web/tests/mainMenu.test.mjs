import test from 'node:test';
import assert from 'node:assert/strict';
import { MainMenu } from '../src/ui/mainMenu.js';
import { ProgressStore } from '../src/progress/progressStore.js';
import { makeElement, withId } from './fakeDom.mjs';

const COLLECTION = 'Microban';

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
  const root = makeElement('body');
  for (const id of ['btn-continue', 'btn-levels', 'btn-menu-mute']) {
    root.append(withId(id, 'button'));
  }

  const fired = [];
  const menu = new MainMenu(root, {
    onContinue: () => fired.push('continue'),
    onSelect: () => fired.push('select'),
    onToggleMute: () => fired.push('mute'),
  });

  return { root, menu, fired, el: (id) => root.querySelector(`#${id}`) };
}

test('a fresh save offers Play rather than Continue', () => {
  const { menu, el } = setup();

  menu.refresh(makeProgress(), COLLECTION, levels(155));

  assert.equal(el('btn-continue').textContent, 'Play');
});

test('past the first level the button names where you left off', () => {
  const { menu, el } = setup();
  const progress = makeProgress();
  progress.setLastPlayedIndex(COLLECTION, 12);

  menu.refresh(progress, COLLECTION, levels(155));

  assert.equal(el('btn-continue').textContent, 'Continue (level 13)');
});

test('the label uses the level name, not the index plus one', () => {
  const { menu, el } = setup();
  const progress = makeProgress();
  progress.setLastPlayedIndex(COLLECTION, 1);

  menu.refresh(progress, COLLECTION, [
    { name: 'warm-up', width: 3, height: 3, rows: [] },
    { name: 'the tricky one', width: 3, height: 3, rows: [] },
  ]);

  assert.equal(el('btn-continue').textContent, 'Continue (level the tricky one)');
});

test('progress pointing past the end of a shrunken set is clamped, not shown raw', () => {
  const { menu, el } = setup();
  const progress = makeProgress();
  progress.setLastPlayedIndex(COLLECTION, 900);   // e.g. hand-edited localStorage

  menu.refresh(progress, COLLECTION, levels(5));

  assert.equal(el('btn-continue').textContent, 'Continue (level 5)',
    'clamps to the last real level instead of naming one that does not exist');
});

test('the mute button reflects the stored setting', () => {
  const { menu, el } = setup();
  const progress = makeProgress();

  menu.refresh(progress, COLLECTION, levels(3));
  assert.equal(el('btn-menu-mute').textContent, 'Sound: on');
  assert.equal(el('btn-menu-mute').getAttribute('aria-pressed'), 'false');

  progress.muted = true;
  menu.refresh(progress, COLLECTION, levels(3));
  assert.equal(el('btn-menu-mute').textContent, 'Sound: off');
  assert.equal(el('btn-menu-mute').getAttribute('aria-pressed'), 'true');
});

test('each button fires its own callback', () => {
  const { menu, fired, el } = setup();
  menu.refresh(makeProgress(), COLLECTION, levels(3));

  el('btn-continue').dispatch('click');
  el('btn-levels').dispatch('click');
  el('btn-menu-mute').dispatch('click');

  assert.deepEqual(fired, ['continue', 'select', 'mute']);
});
