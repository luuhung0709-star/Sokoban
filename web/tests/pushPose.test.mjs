import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { LevelPlayer } from '../src/view/levelPlayer.js';
import { Command } from '../src/input/inputRouter.js';
import { makeLevel } from './helpers.mjs';

/**
 * A fake renderer: it only keeps the facing and records the last setPlayerPushing
 * call. Enough to check what triggers the push pose, with no DOM involved.
 */
function makeRenderer(facing = Direction.Down) {
  return {
    playerFacing: facing,
    pushing: null,
    calls: 0,
    setPlayerFacing(dir) { this.playerFacing = dir; },
    setPlayerPushing(on) { this.pushing = on; this.calls++; },
    fitCellSize() {},
    refreshBoxLook() {},
    boxElAt() { return null; },
    rekeyBox() {},
    placeActor() {},
    playerEl: {},
    clearHint() {},
  };
}

/** A fake animator: runs the callback and returns at once, awaiting no transition. */
function makeAnimator() {
  return {
    isBusy: false,
    async play() {},
    snap(_board, after) { after?.(); },
  };
}

function makePlayer(rows, { facing = Direction.Down } = {}) {
  const session = new GameSession(makeLevel(rows));
  const renderer = makeRenderer(facing);
  const player = new LevelPlayer({
    session,
    renderer,
    animator: makeAnimator(),
    router: { heldDirection: null },
  });
  return { session, renderer, player };
}

test('starting a level already braced against a box enters the push pose immediately', () => {
  // The character faces down, with a box directly below.
  const { renderer, player } = makePlayer([
    '#####',
    '# @ #',
    '# $ #',
    '# . #',
    '#####',
  ]);

  player.start();

  assert.equal(renderer.pushing, true);
});

test('starting a level with nothing ahead does not enter the push pose', () => {
  const { renderer, player } = makePlayer([
    '#####',
    '# @ #',
    '#   #',
    '# .$#',
    '#####',
  ]);

  player.start();

  assert.equal(renderer.pushing, false);
});

test('turning to face a box enters the push pose, even with no push made yet', async () => {
  // The box is to the right, with a wall right behind it, so the move is blocked.
  const { renderer, player } = makePlayer([
    '#####',
    '#@$##',
    '#  .#',
    '#####',
  ]);
  player.start();
  assert.equal(renderer.pushing, false);   // initially facing down, with empty floor below

  player.handle(Command.Right);
  await new Promise((resolve) => setTimeout(resolve, 0));

  // The move is blocked, but the character still turns right and is braced on the box.
  assert.equal(renderer.playerFacing, Direction.Right);
  assert.equal(renderer.pushing, true);
});

test('after a push the character is still braced, so the push pose stays', async () => {
  const { renderer, player } = makePlayer([
    '######',
    '#@$ .#',
    '######',
  ]);
  player.start();

  player.handle(Command.Right);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(renderer.pushing, true);
});

test('walking away from the box drops the push pose', async () => {
  const { renderer, player } = makePlayer([
    '######',
    '#$@ .#',
    '######',
  ], { facing: Direction.Left });

  player.start();
  assert.equal(renderer.pushing, true);    // facing left, with the box on the left

  player.handle(Command.Right);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(renderer.playerFacing, Direction.Right);
  assert.equal(renderer.pushing, false);
});

test('an undo that puts the character back against the box re-enables the push pose', async () => {
  const { renderer, player } = makePlayer([
    '#######',
    '#@$  .#',
    '#######',
  ]);
  player.start();

  player.handle(Command.Right);            // push the box right
  await new Promise((resolve) => setTimeout(resolve, 0));
  player.handle(Command.Right);            // push again
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(renderer.pushing, true);

  player.handle(Command.Undo);
  await new Promise((resolve) => setTimeout(resolve, 0));

  // One move back: box and character both step back, so they stay adjacent.
  assert.equal(renderer.pushing, true);
});
