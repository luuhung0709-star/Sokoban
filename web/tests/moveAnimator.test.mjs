import test from 'node:test';
import assert from 'node:assert/strict';
import { MoveAnimator } from '../src/view/moveAnimator.js';
import { makeElement } from './fakeDom.mjs';

/**
 * A fake renderer that records placements, so the order and target of each move can be
 * asserted without a real board.
 */
function makeRenderer() {
  return {
    playerEl: makeElement('div'),
    placed: [],
    rekeyed: [],
    built: 0,
    boxes: new Map(),
    build() { this.built++; },
    placeActor(el, x, y) { this.placed.push({ el, x, y }); },
    boxElAt(x, y) { return this.boxes.get(`${x},${y}`) ?? null; },
    rekeyBox(fx, fy, tx, ty) { this.rekeyed.push({ fx, fy, tx, ty }); },
    fitCellSize() {},
    refreshBoxLook() {},
  };
}

const move = (over = {}) => ({
  dir: 'Right', blocked: false, push: false,
  from: { x: 1, y: 1 }, to: { x: 2, y: 1 },
  boxFrom: null, boxTo: null,
  ...over,
});

const pushMove = () => move({ push: true, boxFrom: { x: 2, y: 1 }, boxTo: { x: 3, y: 1 } });

const board = { width: 5, height: 3 };

test('play moves the player to the target square', async () => {
  const renderer = makeRenderer();
  const root = makeElement('div');
  const animator = new MoveAnimator(renderer, root);

  const done = animator.play(move());
  renderer.playerEl.dispatch('transitionend');
  await done;

  const last = renderer.placed.at(-1);
  assert.equal(last.el, renderer.playerEl);
  assert.deepEqual([last.x, last.y], [2, 1]);
});

test('a push moves the box before the player, and rekeys it', async () => {
  const renderer = makeRenderer();
  const boxEl = makeElement('div');
  renderer.boxes.set('2,1', boxEl);
  const animator = new MoveAnimator(renderer, makeElement('div'));

  const done = animator.play(pushMove());
  renderer.playerEl.dispatch('transitionend');
  await done;

  assert.deepEqual(renderer.rekeyed, [{ fx: 2, fy: 1, tx: 3, ty: 1 }]);
  assert.equal(renderer.placed[0].el, boxEl, 'the box is placed first');
  assert.deepEqual([renderer.placed[0].x, renderer.placed[0].y], [3, 1]);
  assert.equal(renderer.placed[1].el, renderer.playerEl);
});

test('reverse sends the player back and the box home', async () => {
  const renderer = makeRenderer();
  const boxEl = makeElement('div');
  renderer.boxes.set('3,1', boxEl);   // the box sits where the push left it
  const animator = new MoveAnimator(renderer, makeElement('div'));

  const done = animator.play(pushMove(), { reverse: true });
  renderer.playerEl.dispatch('transitionend');
  await done;

  assert.deepEqual(renderer.rekeyed, [{ fx: 3, fy: 1, tx: 2, ty: 1 }]);
  assert.deepEqual([renderer.placed[0].x, renderer.placed[0].y], [2, 1], 'box back to 2,1');
  assert.deepEqual([renderer.placed[1].x, renderer.placed[1].y], [1, 1], 'player back to 1,1');
});

test('isBusy is on for the duration of a move and off once it lands', async () => {
  const renderer = makeRenderer();
  const animator = new MoveAnimator(renderer, makeElement('div'));

  assert.equal(animator.isBusy, false);

  const done = animator.play(move());
  assert.equal(animator.isBusy, true, 'busy while the transition runs');

  renderer.playerEl.dispatch('transitionend');
  await done;
  assert.equal(animator.isBusy, false);
});

test('a transition that never fires still resolves, via the fallback timer', async () => {
  const renderer = makeRenderer();
  const animator = new MoveAnimator(renderer, makeElement('div'));

  // No transitionend is ever dispatched — this is the hidden-tab case. Without the
  // fallback the await below would hang and the test would time out.
  await animator.play(move());

  assert.equal(animator.isBusy, false);
});

test('a second transitionend does not resolve anything twice', async () => {
  const renderer = makeRenderer();
  const animator = new MoveAnimator(renderer, makeElement('div'));

  const done = animator.play(move());
  renderer.playerEl.dispatch('transitionend');
  renderer.playerEl.dispatch('transitionend');
  await done;

  assert.equal(renderer.playerEl.listenerCount('transitionend'), 0,
    'the handler unsubscribes itself, so a stray event finds nothing to run');
});

test('snap rebuilds the board with transitions switched off, then back on', () => {
  const renderer = makeRenderer();
  const root = makeElement('div');
  const animator = new MoveAnimator(renderer, root);
  let classDuringCallback = null;

  animator.snap(board, () => { classDuringCallback = root.classList.contains('board--no-anim'); });

  assert.equal(renderer.built, 1);
  assert.equal(classDuringCallback, true,
    'the after callback must run while animation is still disabled');
  assert.equal(root.classList.contains('board--no-anim'), false, 'and be re-enabled afterwards');
});

test('snap works without an after callback', () => {
  const renderer = makeRenderer();
  const animator = new MoveAnimator(renderer, makeElement('div'));

  assert.doesNotThrow(() => animator.snap(board));
  assert.equal(renderer.built, 1);
});

test('snap clears a busy flag left behind by an abandoned animation', () => {
  const renderer = makeRenderer();
  const animator = new MoveAnimator(renderer, makeElement('div'));

  animator.play(move());              // deliberately not awaited: still in flight
  assert.equal(animator.isBusy, true);

  animator.snap(board);

  assert.equal(animator.isBusy, false,
    'a new level must not inherit the old one\'s busy flag, or its first command is swallowed');
});

test('an animation finishing after a rebuild does not clear the new board\'s busy flag', async () => {
  const renderer = makeRenderer();
  const animator = new MoveAnimator(renderer, makeElement('div'));

  // The stale move gets no transitionend, so it resolves late off the fallback timer —
  // which is exactly the race the generation counter exists to survive.
  const stale = animator.play(move());
  animator.snap(board);                  // level change: bumps the generation
  const fresh = animator.play(move());   // the new level starts its own move
  assert.equal(animator.isBusy, true);

  await stale;

  // Strip the generation guard and the stale move's finally block clears the flag here,
  // letting the new level accept a second command while `fresh` is still mid-flight.
  assert.equal(animator.isBusy, true,
    'a finished animation from the old level must not free the new one');

  renderer.playerEl.dispatch('transitionend');
  await fresh;
  assert.equal(animator.isBusy, false);
});
