import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { BoardRenderer } from '../src/view/boardRenderer.js';
import { makeBoard } from './helpers.mjs';

/**
 * A minimal fake DOM — just enough for BoardRenderer to build its tree and find
 * elements again.
 *
 * Why this file exists: sprite selection by facing and by push state had no test
 * coverage at all, so every "why is the character not turning?" doubt was guesswork.
 * These tests answer it for good by running the real code.
 */
function makeElement(tag) {
  return {
    tagName: tag,
    className: '',
    dataset: {},
    style: { setProperty() {} },
    children: [],
    set textContent(_) { this.children = []; },
    get textContent() { return ''; },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, on) { on ? this._set.add(c) : this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    append(...kids) { this.children.push(...kids); },
    addEventListener() {},
    querySelector(sel) {
      const want = sel.replace(/^\./, '');
      const walk = (node) => {
        for (const kid of node.children) {
          if (String(kid.className).split(/\s+/).includes(want)) return kid;
          const found = walk(kid);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },
  };
}

globalThis.document = { createElement: makeElement };

function build(rows = ['#####', '#@$.#', '#####']) {
  const board = makeBoard(rows);
  const renderer = new BoardRenderer(makeElement('div'));
  renderer.build(board);
  return { board, renderer };
}

const spriteOf = (renderer) => renderer.playerEl.querySelector('.actor__sprite').src;

test('faces down by default', () => {
  const { renderer } = build();
  assert.match(spriteOf(renderer), /player_down\.png$/);
});

test('turning up switches to the from-behind sprite', () => {
  const { renderer } = build();

  renderer.setPlayerFacing(Direction.Up);

  assert.match(spriteOf(renderer), /player_up\.png$/);
});

test('switches through all four directions', () => {
  const { renderer } = build();
  for (const [dir, file] of [
    [Direction.Left, 'player_left'],
    [Direction.Right, 'player_right'],
    [Direction.Up, 'player_up'],
    [Direction.Down, 'player_down'],
  ]) {
    renderer.setPlayerFacing(dir);
    assert.match(spriteOf(renderer), new RegExp(`${file}\\.png$`), `facing ${dir}`);
  }
});

test('braced against a box uses the push sprite for that same direction', () => {
  const { renderer } = build();

  renderer.setPlayerFacing(Direction.Up);
  renderer.setPlayerPushing(true);

  assert.match(spriteOf(renderer), /player_push_up\.png$/);
});

test('leaving the box returns to the normal sprite, still facing correctly', () => {
  const { renderer } = build();
  renderer.setPlayerFacing(Direction.Up);
  renderer.setPlayerPushing(true);

  renderer.setPlayerPushing(false);

  assert.match(spriteOf(renderer), /player_up\.png$/);
});

test('turning while pushing switches to the new direction push sprite', () => {
  const { renderer } = build();
  renderer.setPlayerPushing(true);
  renderer.setPlayerFacing(Direction.Left);

  assert.match(spriteOf(renderer), /player_push_left\.png$/);
});

test('playerFacing reports the current direction', () => {
  const { renderer } = build();
  renderer.setPlayerFacing(Direction.Right);
  assert.equal(renderer.playerFacing, Direction.Right);
});

test('rebuilding the board resets facing to the default rather than keeping the old level facing', () => {
  const { renderer, board } = build();
  renderer.setPlayerFacing(Direction.Up);

  renderer.build(board);

  assert.equal(renderer.playerFacing, Direction.Down);
  assert.match(spriteOf(renderer), /player_down\.png$/);
});
