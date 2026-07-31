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

// Upper case is a push, lower case a plain move — the Sokoban community LURD convention.
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

test('the collection holds exactly 155 levels', () => {
  assert.equal(collection.collectionName, 'Microban');
  assert.equal(collection.levels.length, 155);
});

test('every level is structurally valid', () => {
  const broken = collection.levels
    .map((level, index) => ({ index, name: level.name, issues: validateLevel(level) }))
    .filter((r) => r.issues.length > 0);

  assert.deepEqual(broken, []);
});

test('every level has equal-length rows matching its width', () => {
  for (const level of collection.levels) {
    assert.equal(level.rows.length, level.height, `level ${level.name} has the wrong height`);
    for (const row of level.rows) {
      assert.equal(row.length, level.width, `level ${level.name} has a row not matching width`);
    }
  }
});

for (const [index, solution] of Object.entries(SOLUTIONS)) {
  const level = collection.levels[Number(index)];

  test(`the solution for level "${level.name}" reaches the solved state`, () => {
    const session = new GameSession(level);

    for (const letter of solution) {
      const dir = LETTER_TO_DIR[letter.toLowerCase()];
      assert.ok(dir, `unexpected character in the solution: ${letter}`);
      assert.ok(session.tryMove(dir), `move ${letter} was blocked in level ${level.name}`);
    }

    assert.equal(session.isSolved, true);
    assert.equal(session.moves, solution.length);
  });
}
