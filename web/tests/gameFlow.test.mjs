import test from 'node:test';
import assert from 'node:assert/strict';
import { GameFlow } from '../src/ui/gameFlow.js';
import { ProgressStore } from '../src/progress/progressStore.js';
import { Command } from '../src/input/inputRouter.js';
import { Direction } from '../src/core/direction.js';
import { makeLevel } from './helpers.mjs';
import { installDocument } from './fakeDom.mjs';

installDocument();

const COLLECTION = 'Microban';

function makeProgress() {
  const data = new Map();
  return new ProgressStore({
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  });
}

/** Two levels; the first is solved by a single push to the right. */
const collection = () => ({
  collectionName: COLLECTION,
  levels: [
    makeLevel(['#####', '#@$.#', '#####'], 'one'),
    makeLevel(['######', '#@$ .#', '######'], 'two'),
  ],
});

function setup() {
  const handlers = [];
  const router = {
    attached: 0,
    heldDirection: null,
    msUntilRepeat: null,
    attach() { this.attached++; },
    onCommand(fn) {
      handlers.push(fn);
      return () => { handlers.splice(handlers.indexOf(fn), 1); };
    },
    send(command) { for (const fn of [...handlers]) fn(command); },
    get handlerCount() { return handlers.length; },
  };

  const renderer = {
    playerFacing: Direction.Down,
    fitCellSize() {},
    setPlayerFacing(d) { this.playerFacing = d; },
    setPlayerPushing() {},
    refreshBoxLook() {},
    boxElAt: () => null,
    rekeyBox() {},
    placeActor() {},
    playerEl: {},
  };

  const animator = { isBusy: false, async play() {}, snap(_b, after) { after?.(); } };

  let bound = 0;
  const hud = {
    label: null,
    setLevelLabel(text) { this.label = text; },
    bind() { bound++; return () => { bound--; }; },
    get boundCount() { return bound; },
  };

  const panels = {
    menu: { refreshed: 0, refresh() { this.refreshed++; } },
    levelSelect: { rendered: 0, render() { this.rendered++; } },
    levelComplete: { shown: [], hidden: 0, show(a) { this.shown.push(a); }, hide() { this.hidden++; } },
  };

  const audio = { played: [], play(name) { this.played.push(name); } };
  const progress = makeProgress();
  const coll = collection();

  const flow = new GameFlow({
    collection: coll, progress, router, renderer, animator, hud, panels, audio,
  });

  return {
    flow, router, hud, panels, audio, progress, coll, renderer,
    screen: () => document.body.dataset.screen,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test('start attaches the router and opens the menu', () => {
  const { flow, router, panels, screen } = setup();

  flow.start();

  assert.equal(router.attached, 1);
  assert.equal(screen(), 'menu');
  assert.equal(panels.menu.refreshed, 1);
});

test('showLevelSelect renders the grid and switches screen', () => {
  const { flow, panels, screen } = setup();

  flow.showLevelSelect();

  assert.equal(panels.levelSelect.rendered, 1);
  assert.equal(screen(), 'levels');
});

test('playLevel switches to the board and labels it by name', () => {
  const { flow, hud, screen } = setup();

  flow.playLevel(1);

  assert.equal(screen(), 'play');
  assert.equal(hud.label, 'Level two', 'the label uses the level name, not the index');
});

test('playLevel remembers where the player is', () => {
  const { flow, progress } = setup();

  flow.playLevel(1);

  assert.equal(progress.getLastPlayedIndex(COLLECTION), 1);
});

test('an index outside the collection leaves the screen alone', () => {
  const { flow, hud, screen } = setup();
  flow.start();

  flow.playLevel(99);

  assert.equal(screen(), 'menu', 'must not strand the player on an empty board');
  assert.equal(hud.label, null);
});

test('leaving a level unhooks the hud and the command router', () => {
  const { flow, router, hud } = setup();

  flow.playLevel(0);
  assert.equal(hud.boundCount, 1);
  assert.equal(router.handlerCount, 1);

  flow.showMenu();

  assert.equal(hud.boundCount, 0, 'the hud must not keep following the old session');
  assert.equal(router.handlerCount, 0, 'the old level must stop receiving commands');
});

test('switching levels leaves exactly one command handler, not two', () => {
  const { flow, router } = setup();

  flow.playLevel(0);
  flow.playLevel(1);

  assert.equal(router.handlerCount, 1, 'a leaked handler would double every keypress');
});

test('solving a level records it and shows the overlay', async () => {
  const { flow, router, panels, progress } = setup();
  flow.playLevel(0);

  router.send(Command.Right);   // one push puts the box on the goal
  await tick();

  assert.equal(panels.levelComplete.shown.length, 1);
  assert.deepEqual(panels.levelComplete.shown[0], {
    moves: 1, pushes: 1, bestMoves: 0, hasNext: true,
  });
  assert.equal(progress.getRecord(COLLECTION, 0).completed, true);
  assert.equal(progress.getRecord(COLLECTION, 0).bestMoves, 1);
});

test('the overlay reports the previous best, not the run just finished', async () => {
  const { flow, router, panels, progress } = setup();
  progress.recordCompletion(COLLECTION, 0, 5, 5);   // an earlier, worse clear

  flow.playLevel(0);
  router.send(Command.Right);
  await tick();

  assert.equal(panels.levelComplete.shown[0].bestMoves, 5,
    'showing the new score here would make every clear look like a tie');
});

test('the last level of the collection reports no next level', async () => {
  const { flow, router, panels } = setup();
  flow.playLevel(1);

  router.send(Command.Right);
  router.send(Command.Right);
  await tick();

  assert.equal(panels.levelComplete.shown.at(-1).hasNext, false);
});

test('solving plays the win sound', async () => {
  const { flow, router, audio } = setup();
  flow.playLevel(0);

  router.send(Command.Right);
  await tick();

  assert.ok(audio.played.includes('win'));
});

test('nextLevel and retryLevel move to the right index', () => {
  const { flow, hud } = setup();

  flow.playLevel(0);
  flow.nextLevel();
  assert.equal(hud.label, 'Level two');

  flow.retryLevel();
  assert.equal(hud.label, 'Level two', 'retry reloads the same level');
});

test('entering a level hides any overlay left from the previous one', () => {
  const { flow, panels } = setup();

  flow.playLevel(0);

  assert.ok(panels.levelComplete.hidden > 0);
});

test('handleResize is a no-op when no level is loaded', () => {
  const { flow } = setup();

  assert.doesNotThrow(() => flow.handleResize());
});

test('Restart behind the win overlay plays the level again', async () => {
  // Every other play command is dead once the level is solved, because the overlay
  // covers the board. Restart is the one a player still wants from there — and since
  // the toolbar button is gone, the R key is the only way to reach it by keyboard.
  const { flow, router, panels } = setup();
  flow.playLevel(0);

  router.send(Command.Right);   // one push solves level one
  await tick();
  assert.equal(panels.levelComplete.shown.length, 1, 'guard: the level really is solved');
  const hiddenBefore = panels.levelComplete.hidden;

  router.send(Command.Restart);
  await tick();

  assert.ok(panels.levelComplete.hidden > hiddenBefore, 'the win overlay must come down');

  router.send(Command.Right);   // the board is live again, so this solves it a second time
  await tick();
  assert.equal(panels.levelComplete.shown.length, 2,
    'a restarted level must be playable, not just repainted behind a hidden overlay');
});
