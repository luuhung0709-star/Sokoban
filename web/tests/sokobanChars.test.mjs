import test from 'node:test';
import assert from 'node:assert/strict';
import { isGrid, isContent, countPieces } from '../src/levels/sokobanChars.js';

test('isGrid nhận đúng bảy ký tự lưới', () => {
  for (const c of ['#', ' ', '@', '+', '$', '*', '.']) {
    assert.equal(isGrid(c), true, `${JSON.stringify(c)} phải là ký tự lưới`);
  }
});

test('isGrid từ chối chữ, số và ký tự lạ', () => {
  for (const c of ['a', 'T', '1', ':', '\t']) {
    assert.equal(isGrid(c), false, `${JSON.stringify(c)} không phải ký tự lưới`);
  }
});

test('isContent loại nền trống ra khỏi ký tự lưới', () => {
  assert.equal(isContent(' '), false);
  assert.equal(isContent('#'), true);
  assert.equal(isContent('.'), true);
  assert.equal(isContent('a'), false);
});

test('countPieces đếm đúng người chơi, hộp và đích', () => {
  const counts = countPieces(['#####', '#@$.#', '#####']);
  assert.equal(counts.players, 1);
  assert.equal(counts.boxes, 1);
  assert.equal(counts.goals, 1);
  assert.deepEqual(counts.playerPos, { x: 1, y: 1 });
});

test('countPieces tính * và + vào cả hai phía', () => {
  // '*' vừa là hộp vừa là đích; '+' vừa là người vừa là đích.
  const counts = countPieces(['#+*#']);
  assert.equal(counts.players, 1);
  assert.equal(counts.boxes, 1);
  assert.equal(counts.goals, 2);
  assert.deepEqual(counts.playerPos, { x: 1, y: 0 });
});

test('countPieces trên lưới không có người trả playerPos null', () => {
  assert.equal(countPieces(['####']).playerPos, null);
});
