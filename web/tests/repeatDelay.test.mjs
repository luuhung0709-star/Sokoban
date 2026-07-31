import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { LevelPlayer } from '../src/view/levelPlayer.js';
import { Command } from '../src/input/inputRouter.js';
import { makeLevel } from './helpers.mjs';

/**
 * Router giả: điều khiển tay hai thứ mà LevelPlayer hỏi — hướng đang giữ và
 * quãng nghỉ còn lại. Nhờ vậy kiểm tra được logic lặp phím mà không cần bàn
 * phím thật lẫn đồng hồ thật.
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
 * Hành lang dài để đi thoải mái không đụng tường. Phải có hộp và đích thật:
 * màn không hộp nào thì `isSolved` đúng ngay từ đầu, và `handle` chặn sạch mọi
 * lệnh — test sẽ xanh hay đỏ vì lý do chẳng liên quan gì tới lặp phím.
 * Hộp nằm ở hàng dưới, không cản đường đi ngang của người chơi.
 */
const CORRIDOR = [
  '##########',
  '#@      .#',
  '#   $    #',
  '##########',
];

test('gõ một phát chỉ đi đúng một ô, dù phím vẫn đang giữ', async () => {
  // msUntilRepeat > 0 nghĩa là vừa bấm, chưa qua quãng nghỉ.
  const { session, player } = makePlayer(CORRIDOR, makeRouter({
    heldDirection: Direction.Right,
    msUntilRepeat: 400,
  }));

  player.handle(Command.Right);
  await settle(30);

  assert.equal(session.board.player.x, 2, 'chỉ được đi một ô trong lúc còn chờ');
});

test('qua quãng nghỉ rồi thì phím giữ mới tự đi tiếp', async () => {
  const router = makeRouter({ heldDirection: Direction.Right, msUntilRepeat: 0 });
  const { session, player } = makePlayer(CORRIDOR, router);

  player.handle(Command.Right);
  await settle(5);
  // Buông phím để vòng lặp dừng, rồi đếm.
  router.heldDirection = null;
  router.msUntilRepeat = null;
  await settle(20);

  assert.ok(session.board.player.x > 2, `phải đi được nhiều hơn một ô, hiện x=${session.board.player.x}`);
});

test('buông phím trong lúc đang chờ thì dừng lại luôn', async () => {
  const router = makeRouter({ heldDirection: Direction.Right, msUntilRepeat: 40 });
  const { session, player } = makePlayer(CORRIDOR, router);

  player.handle(Command.Right);
  // Buông ngay, trước khi hết quãng nghỉ.
  router.heldDirection = null;
  router.msUntilRepeat = null;
  await settle(120);

  assert.equal(session.board.player.x, 2, 'đã buông thì không đi thêm');
});

test('bấm phím mới trong lúc chờ thì đi ngay, không phải đợi hết quãng nghỉ', async () => {
  const router = makeRouter({ heldDirection: Direction.Right, msUntilRepeat: 400 });
  const { session, player } = makePlayer(CORRIDOR, router);

  player.handle(Command.Right);
  await settle(5);
  player.handle(Command.Right);      // gõ phát thứ hai
  await settle(30);

  assert.equal(session.board.player.x, 3, 'hai lần gõ phải ra đúng hai ô');
});

test('phím bấm giữa chừng không đẻ ra vòng lặp thứ hai', async () => {
  // Nếu thiếu chốt #looping, mỗi lệnh mới sẽ khởi động thêm một vòng lặp và
  // nhân vật đi gấp đôi số ô đáng ra phải đi.
  const router = makeRouter({ heldDirection: Direction.Right, msUntilRepeat: 400 });
  const { session, player } = makePlayer(CORRIDOR, router);

  player.handle(Command.Right);
  player.handle(Command.Right);
  player.handle(Command.Right);      // hai lệnh sau chỉ được đệm, đệm tối đa 1
  await settle(60);

  assert.ok(session.board.player.x <= 3, `đệm tối đa 1 lệnh nên nhiều nhất 2 ô, hiện x=${session.board.player.x}`);
});

test('nước bị chặn thì không tự đi tiếp dù đang giữ phím', async () => {
  const router = makeRouter({ heldDirection: Direction.Left, msUntilRepeat: 0 });
  const { session, player } = makePlayer(['#####', '#@ .#', '# $ #', '#####'], router);

  player.handle(Command.Left);       // bên trái là tường
  await settle(40);

  assert.equal(session.board.player.x, 1, 'đứng yên tại chỗ');
});

test('router không khai báo msUntilRepeat thì coi như không giữ phím', async () => {
  // Giữ tương thích: nơi gọi cũ chỉ có heldDirection.
  const { session, player } = makePlayer(CORRIDOR, { heldDirection: Direction.Right });

  player.handle(Command.Right);
  await settle(40);

  assert.equal(session.board.player.x, 2);
});
