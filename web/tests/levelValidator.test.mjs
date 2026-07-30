import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLevel } from '../src/levels/levelValidator.js';
import { makeLevel } from './helpers.mjs';

test('màn đúng chuẩn không có lỗi nào', () => {
  assert.deepEqual(validateLevel(makeLevel(['#####', '#@$.#', '#####'])), []);
});

test('màn rỗng bị báo lỗi', () => {
  assert.equal(validateLevel(makeLevel([])).length, 1);
  assert.match(validateLevel({ name: 'x', width: 0, height: 0, rows: [] })[0], /rỗng/);
});

test('thiếu hoặc thừa người chơi đều bị bắt', () => {
  assert.match(validateLevel(makeLevel(['#####', '# $.#', '#####']))[0], /một người chơi/);
  assert.match(validateLevel(makeLevel(['######', '#@$.@#', '######']))[0], /một người chơi/);
});

test('số hộp khác số đích bị bắt', () => {
  const issues = validateLevel(makeLevel(['######', '#@$$.#', '######']));
  assert.equal(issues.length, 1);
  assert.match(issues[0], /Số hộp/);
});

test('màn không có hộp nào bị bắt', () => {
  assert.match(validateLevel(makeLevel(['#####', '#@  #', '#####']))[0], /không có hộp/);
});

test('vùng chơi hở bị bắt', () => {
  // Thiếu tường ở cạnh phải nên người chơi đi ra ngoài lưới được.
  const issues = validateLevel(makeLevel(['#####', '#@$. ', '#####']));
  assert.ok(issues.some((m) => /chưa kín/.test(m)));
});

test('vùng chơi kín thì không báo hở', () => {
  const issues = validateLevel(makeLevel(['#####', '#@$.#', '#####']));
  assert.equal(issues.some((m) => /chưa kín/.test(m)), false);
});
