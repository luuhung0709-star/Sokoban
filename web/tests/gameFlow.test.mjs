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
    hints: [],
    cleared: 0,
    showHint(box, dir) { this.hints.push({ box, dir }); },
    clearHint() { this.cleared++; },
  };

  const animator = { isBusy: false, async play() {}, snap(_b, after) { after?.(); } };

  let bound = 0;
  const hud = {
    label: null,
    hintBusy: [],
    noHintFlashes: 0,
    setLevelLabel(text) { this.label = text; },
    setHintBusy(on) { this.hintBusy.push(on); },
    flashNoHint() { this.noHintFlashes++; },
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

  const hintService = {
    asked: 0,
    hint: null,
    requestHint() { this.asked++; return Promise.resolve(this.hint); },
  };

  const flow = new GameFlow({
    collection: coll, progress, router, renderer, animator, hud, panels, audio, hintService,
  });

  return {
    flow, router, hud, panels, audio, progress, coll, hintService, renderer,
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

test('the hint button drives the hud through its thinking state', async () => {
  const { flow, router, hud, hintService } = setup();
  hintService.hint = { box: { x: 2, y: 1 }, dir: Direction.Right };
  flow.playLevel(0);

  router.send(Command.Hint);
  await tick();

  assert.equal(hintService.asked, 1);
  assert.deepEqual(hud.hintBusy, [true, false], 'busy must be switched off again');
  assert.equal(hud.noHintFlashes, 0);
});

test('a search that found nothing flashes the message', async () => {
  const { flow, router, hud, hintService } = setup();
  hintService.hint = null;
  flow.playLevel(0);

  router.send(Command.Hint);
  await tick();

  assert.equal(hud.noHintFlashes, 1);
});

test('a found hint is drawn using the exact box and direction the solver returned', async () => {
  const { flow, router, renderer, hintService } = setup();
  hintService.hint = { box: { x: 2, y: 1 }, dir: Direction.Right };
  flow.playLevel(0);

  router.send(Command.Hint);
  await tick();

  assert.deepEqual(renderer.hints, [{ box: { x: 2, y: 1 }, dir: Direction.Right }],
    'a deleted showHint call or swapped arguments must fail this');
});

test('a move made while the search is still running throws the answer away', async () => {
  const { flow, router, renderer, hud, hintService } = setup();
  let resolveHint;
  hintService.requestHint = () => new Promise((resolve) => { resolveHint = resolve; });
  flow.playLevel(0);
  renderer.cleared = 0;   // start() clears too; zero it so the count below is the move's alone

  router.send(Command.Hint);
  router.send(Command.Right);   // the board the search was asked about no longer exists
  await tick();
  resolveHint({ box: { x: 2, y: 1 }, dir: Direction.Right });
  await tick();

  assert.equal(renderer.hints.length, 0, 'a hint for an outdated board must not be drawn');
  assert.equal(hud.noHintFlashes, 0, 'stale is not the same as "the solver found nothing"');
  assert.ok(renderer.cleared > 0,
    'the move must clear the stale arrow, or it would keep pointing the pre-move direction');
  assert.deepEqual(hud.hintBusy, [true, false],
    'the button must leave its thinking state even though the answer was thrown away');
});

test('a restart while the search is still running also throws the answer away', async () => {
  const { flow, router, renderer, hud, hintService } = setup();
  let resolveHint;
  hintService.requestHint = () => new Promise((resolve) => { resolveHint = resolve; });
  flow.playLevel(0);

  router.send(Command.Hint);
  router.send(Command.Restart);
  await tick();
  resolveHint({ box: { x: 2, y: 1 }, dir: Direction.Right });
  await tick();

  assert.deepEqual(hud.hintBusy, [true, false],
    'the button must leave its thinking state even though the answer was thrown away');

  // Restart puts `moves` back to 0 — the same value it started at — so a guard keyed
  // on the move count alone sees no change here and would draw the stale hint anyway.
  assert.equal(renderer.hints.length, 0);
});

test('leaving a level mid-search stops the old player from later touching the hud a new level owns', async () => {
  // The hud is a singleton GameFlow rebinds on every playLevel — it is not per-player.
  // A search started on level A that resolves after the player has moved on to level B
  // must not reach into that shared hud and report news about a board nobody is
  // looking at any more.
  const { flow, router, hud, hintService } = setup();
  let resolveHint;
  hintService.requestHint = () => new Promise((resolve) => { resolveHint = resolve; });
  flow.playLevel(0);

  router.send(Command.Hint);
  const busyBeforeSwitch = [...hud.hintBusy];

  flow.playLevel(1);   // leaves level 0 while its search is still in flight

  resolveHint({ box: { x: 2, y: 1 }, dir: Direction.Right });
  await tick();

  assert.deepEqual(hud.hintBusy, busyBeforeSwitch,
    'the stopped player must not push to the hud once another level has taken it over');
});
