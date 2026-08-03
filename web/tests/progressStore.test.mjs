import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore } from '../src/progress/progressStore.js';

/** A fake localStorage, enough for ProgressStore — no browser needed. */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    get size() { return data.size; },
  };
}

test('an unplayed level returns an empty record', () => {
  const store = new ProgressStore(fakeStorage());
  assert.deepEqual(store.getRecord('Microban', 3), {
    index: 3, completed: false, bestMoves: 0, bestPushes: 0,
  });
});

test('the first completion writes the best score straight in', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);

  const record = store.getRecord('Microban', 0);
  assert.equal(record.completed, true);
  assert.equal(record.bestMoves, 33);
  assert.equal(record.bestPushes, 9);
});

test('a best score is only overwritten when beaten', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);
  store.recordCompletion('Microban', 0, 40, 12);
  assert.equal(store.getRecord('Microban', 0).bestMoves, 33);

  store.recordCompletion('Microban', 0, 30, 8);
  assert.equal(store.getRecord('Microban', 0).bestMoves, 30);
  assert.equal(store.getRecord('Microban', 0).bestPushes, 8);
});

test('moves and pushes are compared independently', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);
  store.recordCompletion('Microban', 0, 35, 7);

  assert.equal(store.getRecord('Microban', 0).bestMoves, 33);
  assert.equal(store.getRecord('Microban', 0).bestPushes, 7);
});

test('sequential unlocking: the first level is always open, later ones wait for the previous', () => {
  const store = new ProgressStore(fakeStorage());
  assert.equal(store.isUnlocked('Microban', 0), true);
  assert.equal(store.isUnlocked('Microban', 1), false);

  store.recordCompletion('Microban', 0, 33, 9);
  assert.equal(store.isUnlocked('Microban', 1), true);
  assert.equal(store.isUnlocked('Microban', 2), false);
});

test('lastPlayedIndex can be written and read back', () => {
  const store = new ProgressStore(fakeStorage());
  assert.equal(store.getLastPlayedIndex('Microban'), 0);

  store.setLastPlayedIndex('Microban', 13);
  assert.equal(store.getLastPlayedIndex('Microban'), 13);
});

test('the two sound settings are stored alongside progress', () => {
  const storage = fakeStorage();
  const store = new ProgressStore(storage);
  store.musicOn = false;

  const reloaded = new ProgressStore(storage);
  assert.equal(reloaded.musicOn, false);
  assert.equal(reloaded.sfxOn, true, 'the two switches are independent');
});

test('sound is on by default', () => {
  const store = new ProgressStore(fakeStorage());
  assert.equal(store.musicOn, true);
  assert.equal(store.sfxOn, true);
});

test('written data can be read back by a fresh store', () => {
  const storage = fakeStorage();
  new ProgressStore(storage).recordCompletion('Microban', 5, 20, 4);

  assert.equal(new ProgressStore(storage).getRecord('Microban', 5).bestMoves, 20);
});

test('corrupt JSON resets to empty instead of throwing', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{ shattered' }));
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(store.musicOn, true);
  assert.equal(store.sfxOn, true);
});

test('JSON that parses but lacks fields is still usable', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{}' }));
  assert.equal(store.musicOn, true);
  assert.equal(store.getRecord('Microban', 0).completed, false);
});

test('a save from the days of a single mute switch turns both switches off', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{"muted":true}' }));

  assert.equal(store.musicOn, false);
  assert.equal(store.sfxOn, false, 'the old switch silenced everything, so both must follow');
});

test('an old save with sound left on comes through with both switches on', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{"muted":false}' }));

  assert.equal(store.musicOn, true);
  assert.equal(store.sfxOn, true);
});

test('a migrated save stops carrying the old mute flag', () => {
  const storage = fakeStorage({ 'sokoban.progress': '{"muted":true}' });
  const store = new ProgressStore(storage);

  store.sfxOn = true;   // any write re-serialises the whole root

  const raw = storage.getItem('sokoban.progress');
  assert.equal(JSON.parse(raw).muted, undefined,
    'one save format is enough to reason about; the old flag must not be carried forward');
  assert.equal(JSON.parse(raw).musicOn, false, 'and the migrated value must survive the write');
});

test('sfxOn is stored and retrieved independently', () => {
  const storage = fakeStorage();
  const store = new ProgressStore(storage);
  store.sfxOn = false;

  const reloaded = new ProgressStore(storage);
  assert.equal(reloaded.sfxOn, false);
  assert.equal(reloaded.musicOn, true, 'the two switches are independent');
});

test('a storage that throws on write does not kill the game', () => {
  const store = new ProgressStore({
    getItem: () => null,
    setItem: () => { throw new Error('out of space'); },
    removeItem: () => {},
  });

  assert.doesNotThrow(() => store.recordCompletion('Microban', 0, 33, 9));
});

test('a storage that throws on read resets to empty rather than escaping', () => {
  // Some browsers private mode throws on getItem itself, not on setItem.
  const store = new ProgressStore({
    getItem: () => { throw new Error('blocked'); },
    setItem: () => {},
    removeItem: () => {},
  });

  assert.doesNotThrow(() => store.getRecord('Microban', 0));
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(store.musicOn, true);
  assert.equal(store.sfxOn, true);
});

test('junk entries in collections are filtered out rather than throwing', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{"collections":[null,3,"x"]}' }));

  assert.doesNotThrow(() => store.getLastPlayedIndex('Microban'));
  assert.equal(store.getRecord('Microban', 0).completed, false);
});

test('junk entries in levels are filtered out, keeping the real record', () => {
  const store = new ProgressStore(fakeStorage({
    'sokoban.progress':
      '{"collections":[{"name":"Microban","levels":[null,{"index":0,"completed":true,"bestMoves":33,"bestPushes":9}]}]}',
  }));

  assert.doesNotThrow(() => store.getRecord('Microban', 0));
  assert.equal(store.getRecord('Microban', 0).bestMoves, 33);
});

test('clear wipes the progress', () => {
  const storage = fakeStorage();
  const store = new ProgressStore(storage);
  store.recordCompletion('Microban', 0, 33, 9);

  store.clear();
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(new ProgressStore(storage).getRecord('Microban', 0).completed, false);
});
