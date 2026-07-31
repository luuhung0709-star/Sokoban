import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { LevelPlayer } from '../src/view/levelPlayer.js';
import { Command } from '../src/input/inputRouter.js';
import { makeLevel } from './helpers.mjs';

/**
 * A fake router: hand-controls the two things LevelPlayer asks for — the held
 * direction and the remaining delay. That lets the key-repeat logic be tested
 * without a real keyboard or a real clock.
 */
function makeRouter({ heldDirection = null, msUntilRepeat = null } = {}) {
  return { heldDirection, msUntilRepeat };
}

function makeAnimator() {
  return { isBusy: false, async play() {}, snap(_b, after) { after?.(); } };
}

function makePlayer(rows, router) {
  const session = new GameSession(makeLevel(rows));
  const renderer = {
    playerFacing: Direction.Down,
    setPlayerFacing(d) { this.playerFacing = d; },
    setPlayerPushing() {},
    fitCellSize() {}, refreshBoxLook() {},
    boxElAt: () => null, rekeyBox() {}, placeActor() {}, playerEl: {},
  };
  const player = new LevelPlayer({ session, renderer, animator: makeAnimator(), router });
  return { session, player };
}

const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/*
 * A long corridor to walk freely without hitting a wall. It needs a real box and
 * goal: with no boxes `isSolved` is true from the start and `handle` blocks every
 * command — the tests would then pass or fail for reasons unrelated to key repeat.
 * The box sits on the lower row, clear of the players horizontal path.
 */
const CORRIDOR = [
  '##########',
  '#@      .#',
  '#   $    #',
  '##########',
];

test('a single tap moves exactly one square, even while the key stays held', async () => {
  // msUntilRepeat > 0 means just pressed, the delay has not elapsed.
  const { session, player } = makePlayer(CORRIDOR, makeRouter({
    heldDirection: Direction.Right,
    msUntilRepeat: 400,
  }));

  player.handle(Command.Right);
  await settle(30);

  assert.equal(session.board.player.x, 2, 'only one square while still waiting');
});

test('only past the delay does a held key auto-continue', async () => {
  const router = makeRouter({ heldDirection: Direction.Right, msUntilRepeat: 0 });
  const { session, player } = makePlayer(CORRIDOR, router);

  player.handle(Command.Right);
  await settle(5);
  // Release the key so the loop stops, then count.
  router.heldDirection = null;
  router.msUntilRepeat = null;
  await settle(20);

  assert.ok(session.board.player.x > 2, `should cover more than one square, currently x=${session.board.player.x}`);
});

test('releasing the key mid-wait stops immediately', async () => {
  const router = makeRouter({ heldDirection: Direction.Right, msUntilRepeat: 40 });
  const { session, player } = makePlayer(CORRIDOR, router);

  player.handle(Command.Right);
  // Release at once, before the delay expires.
  router.heldDirection = null;
  router.msUntilRepeat = null;
  await settle(120);

  assert.equal(session.board.player.x, 2, 'released means no further movement');
});

test('a new press mid-wait moves at once instead of waiting out the delay', async () => {
  const router = makeRouter({ heldDirection: Direction.Right, msUntilRepeat: 400 });
  const { session, player } = makePlayer(CORRIDOR, router);

  player.handle(Command.Right);
  await settle(5);
  player.handle(Command.Right);      // second tap
  await settle(30);

  assert.equal(session.board.player.x, 3, 'two taps must give exactly two squares');
});

test('a key pressed mid-loop does not spawn a second loop', async () => {
  // Without the #looping latch, every new command starts another loop and the
  // character covers twice the squares it should.
  const router = makeRouter({ heldDirection: Direction.Right, msUntilRepeat: 400 });
  const { session, player } = makePlayer(CORRIDOR, router);

  player.handle(Command.Right);
  player.handle(Command.Right);
  player.handle(Command.Right);      // the last two are only buffered, and the buffer holds at most 1
  await settle(60);

  assert.ok(session.board.player.x <= 3, `a 1-command buffer means at most 2 squares, currently x=${session.board.player.x}`);
});

test('a blocked move does not auto-continue even with the key held', async () => {
  const router = makeRouter({ heldDirection: Direction.Left, msUntilRepeat: 0 });
  const { session, player } = makePlayer(['#####', '#@ .#', '# $ #', '#####'], router);

  player.handle(Command.Left);       // a wall to the left
  await settle(40);

  assert.equal(session.board.player.x, 1, 'stays put');
});

test('a router without msUntilRepeat counts as no key held', async () => {
  // Backwards compatibility: older callers only provide heldDirection.
  const { session, player } = makePlayer(CORRIDOR, { heldDirection: Direction.Right });

  player.handle(Command.Right);
  await settle(40);

  assert.equal(session.board.player.x, 2);
});
