import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { LevelPlayer } from '../src/view/levelPlayer.js';
import { Command } from '../src/input/inputRouter.js';
import { makeLevel } from './helpers.mjs';

/**
 * Renderer giả: chỉ giữ hướng nhìn và ghi lại lần gọi setPlayerPushing cuối.
 * Đủ để kiểm tra trigger tư thế đẩy mà không cần DOM.
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
  };
}

/** Animator giả: chạy callback rồi trả về ngay, không chờ transition nào. */
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

test('bắt đầu màn mà đã áp sẵn vào hộp thì vào tư thế đẩy ngay', () => {
  // Nhân vật nhìn xuống, ngay dưới là hộp.
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

test('bắt đầu màn không có gì trước mặt thì không vào tư thế đẩy', () => {
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

test('quay mặt vào hộp là vào tư thế đẩy, dù chưa đẩy được nước nào', async () => {
  // Hộp nằm bên phải nhân vật, và ngay sau hộp là tường nên nước đi bị chặn.
  const { renderer, player } = makePlayer([
    '#####',
    '#@$##',
    '#  .#',
    '#####',
  ]);
  player.start();
  assert.equal(renderer.pushing, false);   // ban đầu nhìn xuống, dưới là ô trống

  player.handle(Command.Right);
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Nước bị chặn nhưng nhân vật vẫn quay sang phải và đang áp vào hộp.
  assert.equal(renderer.playerFacing, Direction.Right);
  assert.equal(renderer.pushing, true);
});

test('đẩy hộp xong vẫn còn áp vào nó nên giữ nguyên tư thế đẩy', async () => {
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

test('đi ra xa khỏi hộp thì bỏ tư thế đẩy', async () => {
  const { renderer, player } = makePlayer([
    '######',
    '#$@ .#',
    '######',
  ], { facing: Direction.Left });

  player.start();
  assert.equal(renderer.pushing, true);    // nhìn sang trái, bên trái là hộp

  player.handle(Command.Right);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(renderer.playerFacing, Direction.Right);
  assert.equal(renderer.pushing, false);
});

test('undo đưa nhân vật về sát hộp thì tư thế đẩy bật lại', async () => {
  const { renderer, player } = makePlayer([
    '#######',
    '#@$  .#',
    '#######',
  ]);
  player.start();

  player.handle(Command.Right);            // đẩy hộp sang phải
  await new Promise((resolve) => setTimeout(resolve, 0));
  player.handle(Command.Right);            // đẩy tiếp
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(renderer.pushing, true);

  player.handle(Command.Undo);
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Lùi lại một nước: hộp và người cùng lùi, nên vẫn dính nhau.
  assert.equal(renderer.pushing, true);
});
