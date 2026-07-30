import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { validateLevel } from '../src/levels/levelValidator.js';

const collection = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/levels/microban.json', import.meta.url)), 'utf8'),
);

// Chữ hoa là nước đẩy, chữ thường là nước đi — quy ước LURD của cộng đồng Sokoban.
const LETTER_TO_DIR = {
  u: Direction.Up, d: Direction.Down, l: Direction.Left, r: Direction.Right,
};

const SOLUTIONS = {
  0: 'dlUrrrdLullddrUluRuulDrddrruLdlUU',
  1: 'rddLruulDuullddR',
  2: 'ruuLLLulDrrrrddlUruLLLddllluurRDrdLuuurDD',
  3: 'ullDLdRuurrdLLrrddlUruL',
  4: 'LuRllDrdRdrruuLLdlUddlluR',
};

test('bộ màn có đúng 155 màn', () => {
  assert.equal(collection.collectionName, 'Microban');
  assert.equal(collection.levels.length, 155);
});

test('mọi màn đều hợp lệ về cấu trúc', () => {
  const broken = collection.levels
    .map((level, index) => ({ index, name: level.name, issues: validateLevel(level) }))
    .filter((r) => r.issues.length > 0);

  assert.deepEqual(broken, []);
});

test('mọi màn đều có hàng dài bằng nhau và bằng width', () => {
  for (const level of collection.levels) {
    assert.equal(level.rows.length, level.height, `màn ${level.name} sai height`);
    for (const row of level.rows) {
      assert.equal(row.length, level.width, `màn ${level.name} có hàng lệch width`);
    }
  }
});

for (const [index, solution] of Object.entries(SOLUTIONS)) {
  const level = collection.levels[Number(index)];

  test(`lời giải của màn "${level.name}" đưa bàn cờ về trạng thái thắng`, () => {
    const session = new GameSession(level);

    for (const letter of solution) {
      const dir = LETTER_TO_DIR[letter.toLowerCase()];
      assert.ok(dir, `ký tự lạ trong lời giải: ${letter}`);
      assert.ok(session.tryMove(dir), `nước ${letter} bị chặn ở màn ${level.name}`);
    }

    assert.equal(session.isSolved, true);
    assert.equal(session.moves, solution.length);
  });
}
