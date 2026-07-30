import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMicroban } from '../src/levels/parseMicroban.js';

test('đọc một màn với tên nằm sau lưới', () => {
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

test('pad hàng ngắn cho bằng hàng dài nhất', () => {
  const { levels } = parseMicroban(['####', '#@$.###', '####'].join('\n'));

  assert.equal(levels[0].width, 7);
  assert.deepEqual(levels[0].rows, ['####   ', '#@$.###', '####   ']);
});

test('bỏ qua khối header vì nó không có hàng lưới nào', () => {
  const { levels, errors } = parseMicroban([
    'Title: Microban',
    'Description: mấy màn nhỏ',
    '             viết tiếp ở dòng dưới',
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

test('đọc được cả 7 ký tự', () => {
  // 3 hộp ($ $ *) và 3 đích (. * +) — phải cân nhau, không thì parser báo lỗi.
  const { levels, errors } = parseMicroban(['#+*$$.#', 'Title: x'].join('\n'));

  assert.deepEqual(errors, []);
  assert.deepEqual(levels[0].rows, ['#+*$$.#']);
});

test('nhiều màn cách nhau bằng dòng trống', () => {
  const { levels } = parseMicroban([
    '#####', '#@$.#', '#####', 'Title: 1',
    '',
    '#####', '#@$.#', '#####', 'Title: 2',
  ].join('\n'));

  assert.equal(levels.length, 2);
  assert.deepEqual(levels.map((l) => l.name), ['1', '2']);
});

test('màn không đúng một người chơi thì báo lỗi kèm số dòng và bị bỏ qua', () => {
  const { levels, errors } = parseMicroban([
    '',
    '#####',
    '#@$@#',
    '#####',
  ].join('\n'));

  assert.equal(levels.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Dòng 2/);
  assert.match(errors[0], /2/);
});

test('số hộp khác số đích thì báo lỗi', () => {
  const { errors } = parseMicroban(['#####', '#@$ #', '#####'].join('\n'));

  assert.equal(errors.length, 1);
  assert.match(errors[0], /1 hộp/);
});

test('một màn hỏng không làm hỏng các màn còn lại', () => {
  const { levels, errors } = parseMicroban([
    '#####', '#@$@#', '#####',
    '',
    '#####', '#@$.#', '#####', 'Title: tốt',
  ].join('\n'));

  assert.equal(errors.length, 1);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].name, 'tốt');
});

test('màn không có tên thì tự đặt theo thứ tự', () => {
  const { levels } = parseMicroban(['#####', '#@$.#', '#####'].join('\n'));
  assert.equal(levels[0].name, 'Level 1');
});

test('chuỗi rỗng cho ra kết quả rỗng, không phải lỗi', () => {
  assert.deepEqual(parseMicroban(''), { levels: [], errors: [] });
});

test('xuống dòng kiểu Windows đọc được như thường', () => {
  const { levels } = parseMicroban('#####\r\n#@$.#\r\n#####\r\nTitle: 1');
  assert.equal(levels.length, 1);
  assert.equal(levels[0].width, 5);
});
