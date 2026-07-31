import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { Hud } from '../src/ui/hud.js';
import { Command } from '../src/input/inputRouter.js';
import { makeLevel } from './helpers.mjs';
import { makeElement, withId } from './fakeDom.mjs';

/** The seven ids Hud looks up in its constructor. Missing one throws, which is the point. */
const HUD_IDS = [
  'hud-name', 'hud-moves', 'hud-pushes',
  'btn-undo', 'btn-redo', 'btn-restart', 'btn-exit',
];

function makeRoot() {
  const root = makeElement('body');
  for (const id of HUD_IDS) root.append(withId(id, 'button'));
  return root;
}

/** Records what Hud wired to which button, so the bindings can be asserted. */
function makeRouter() {
  return {
    bound: [],
    bindButton(el, command) { this.bound.push({ id: el.id, command }); },
  };
}

/** A level with a box one square right of the player, and a goal past it. */
const level = () => makeLevel(['#######', '#@$  .#', '#######']);

function setup() {
  const root = makeRoot();
  const router = makeRouter();
  const hud = new Hud(root, router);
  const session = new GameSession(level());
  return { root, router, hud, session, el: (id) => root.querySelector(`#${id}`) };
}

test('the constructor wires all four buttons to their commands', () => {
  const { router } = setup();

  assert.deepEqual(router.bound, [
    { id: 'btn-undo', command: Command.Undo },
    { id: 'btn-redo', command: Command.Redo },
    { id: 'btn-restart', command: Command.Restart },
    { id: 'btn-exit', command: Command.Exit },
  ]);
});

test('setLevelLabel writes into the name slot', () => {
  const { hud, el } = setup();

  hud.setLevelLabel('Level 7');

  assert.equal(el('hud-name').textContent, 'Level 7');
});

test('bind paints the counters immediately, before any move', () => {
  const { hud, session, el } = setup();

  hud.bind(session);

  assert.equal(el('hud-moves').textContent, '0');
  assert.equal(el('hud-pushes').textContent, '0');
});

test('the counters follow the session as it changes', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  session.tryMove(Direction.Right);   // pushes the box

  assert.equal(el('hud-moves').textContent, '1');
  assert.equal(el('hud-pushes').textContent, '1');
});

test('undo and redo are disabled exactly when the history is empty', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  assert.equal(el('btn-undo').disabled, true, 'nothing to undo yet');
  assert.equal(el('btn-redo').disabled, true, 'nothing to redo yet');

  session.tryMove(Direction.Right);
  assert.equal(el('btn-undo').disabled, false);
  assert.equal(el('btn-redo').disabled, true, 'a fresh move leaves no redo branch');

  session.tryUndo();
  assert.equal(el('btn-undo').disabled, true);
  assert.equal(el('btn-redo').disabled, false);
});

test('solving the level greys out undo, redo and restart together', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  // Two pushes put the only box onto the goal.
  session.tryMove(Direction.Right);
  session.tryMove(Direction.Right);
  session.tryMove(Direction.Right);
  assert.equal(session.isSolved, true, 'guard: the level really is solved');

  assert.equal(el('btn-undo').disabled, true, 'undo must not work behind the win overlay');
  assert.equal(el('btn-redo').disabled, true);
  assert.equal(el('btn-restart').disabled, true);
});

test('restart stays enabled while the level is unsolved', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  assert.equal(el('btn-restart').disabled, false);

  session.tryMove(Direction.Right);
  assert.equal(el('btn-restart').disabled, false);
});

test('the function bind returns detaches the hud from that session', () => {
  const { hud, session, el } = setup();
  const unbind = hud.bind(session);

  unbind();
  session.tryMove(Direction.Right);

  assert.equal(el('hud-moves').textContent, '0', 'a detached hud must not follow the old session');
});

test('binding a second session leaves the first one no longer driving the hud', () => {
  const { hud, session, el } = setup();
  const unbind = hud.bind(session);
  unbind();

  const next = new GameSession(level());
  hud.bind(next);
  next.tryMove(Direction.Right);
  session.tryMove(Direction.Right);   // the old one must be inert now

  assert.equal(el('hud-moves').textContent, '1');
});
