import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore } from '../src/progress/progressStore.js';

/** localStorage giả, đủ dùng cho ProgressStore — không cần trình duyệt. */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    get size() { return data.size; },
  };
}

test('màn chưa chơi trả về bản ghi rỗng', () => {
  const store = new ProgressStore(fakeStorage());
  assert.deepEqual(store.getRecord('Microban', 3), {
    index: 3, completed: false, bestMoves: 0, bestPushes: 0,
  });
});

test('hoàn thành lần đầu ghi thẳng kỷ lục', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);

  const record = store.getRecord('Microban', 0);
  assert.equal(record.completed, true);
  assert.equal(record.bestMoves, 33);
  assert.equal(record.bestPushes, 9);
});

test('kỷ lục chỉ bị ghi đè khi tốt hơn', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);
  store.recordCompletion('Microban', 0, 40, 12);
  assert.equal(store.getRecord('Microban', 0).bestMoves, 33);

  store.recordCompletion('Microban', 0, 30, 8);
  assert.equal(store.getRecord('Microban', 0).bestMoves, 30);
  assert.equal(store.getRecord('Microban', 0).bestPushes, 8);
});

test('số bước và số đẩy được so riêng', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);
  store.recordCompletion('Microban', 0, 35, 7);

  assert.equal(store.getRecord('Microban', 0).bestMoves, 33);
  assert.equal(store.getRecord('Microban', 0).bestPushes, 7);
});

test('mở khoá tuần tự: màn đầu luôn mở, màn sau chờ màn trước', () => {
  const store = new ProgressStore(fakeStorage());
  assert.equal(store.isUnlocked('Microban', 0), true);
  assert.equal(store.isUnlocked('Microban', 1), false);

  store.recordCompletion('Microban', 0, 33, 9);
  assert.equal(store.isUnlocked('Microban', 1), true);
  assert.equal(store.isUnlocked('Microban', 2), false);
});

test('lastPlayedIndex ghi và đọc lại được', () => {
  const store = new ProgressStore(fakeStorage());
  assert.equal(store.getLastPlayedIndex('Microban'), 0);

  store.setLastPlayedIndex('Microban', 13);
  assert.equal(store.getLastPlayedIndex('Microban'), 13);
});

test('tắt tiếng lưu chung với tiến độ', () => {
  const storage = fakeStorage();
  const store = new ProgressStore(storage);
  store.muted = true;

  assert.equal(new ProgressStore(storage).muted, true);
});

test('dữ liệu ghi xuống đọc lại được bằng một store mới', () => {
  const storage = fakeStorage();
  new ProgressStore(storage).recordCompletion('Microban', 5, 20, 4);

  assert.equal(new ProgressStore(storage).getRecord('Microban', 5).bestMoves, 20);
});

test('JSON hỏng thì reset về rỗng thay vì ném lỗi', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{ vỡ toác' }));
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(store.muted, false);
});

test('JSON đúng cú pháp nhưng thiếu trường thì vẫn dùng được', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{"muted":true}' }));
  assert.equal(store.muted, true);
  assert.equal(store.getRecord('Microban', 0).completed, false);
});

test('storage ném lỗi lúc ghi thì game không chết', () => {
  const store = new ProgressStore({
    getItem: () => null,
    setItem: () => { throw new Error('hết chỗ'); },
    removeItem: () => {},
  });

  assert.doesNotThrow(() => store.recordCompletion('Microban', 0, 33, 9));
});

test('storage ném lỗi lúc đọc thì reset về rỗng, không ném ra ngoài', () => {
  // Chế độ riêng tư của một số trình duyệt ném lỗi ngay ở getItem, không phải setItem.
  const store = new ProgressStore({
    getItem: () => { throw new Error('bị chặn'); },
    setItem: () => {},
    removeItem: () => {},
  });

  assert.doesNotThrow(() => store.getRecord('Microban', 0));
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(store.muted, false);
});

test('collections chứa phần tử rác thì bị lọc, không ném lỗi', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{"collections":[null,3,"x"]}' }));

  assert.doesNotThrow(() => store.getLastPlayedIndex('Microban'));
  assert.equal(store.getRecord('Microban', 0).completed, false);
});

test('levels chứa phần tử rác thì bị lọc, giữ lại bản ghi thật', () => {
  const store = new ProgressStore(fakeStorage({
    'sokoban.progress':
      '{"collections":[{"name":"Microban","levels":[null,{"index":0,"completed":true,"bestMoves":33,"bestPushes":9}]}]}',
  }));

  assert.doesNotThrow(() => store.getRecord('Microban', 0));
  assert.equal(store.getRecord('Microban', 0).bestMoves, 33);
});

test('clear xoá sạch tiến độ', () => {
  const storage = fakeStorage();
  const store = new ProgressStore(storage);
  store.recordCompletion('Microban', 0, 33, 9);

  store.clear();
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(new ProgressStore(storage).getRecord('Microban', 0).completed, false);
});
