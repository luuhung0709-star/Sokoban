import test from 'node:test';
import assert from 'node:assert/strict';
import { HintService } from '../src/core/hintService.js';
import { Direction } from '../src/core/direction.js';
import { makeBoard } from './helpers.mjs';

/** Stands in for a real Worker: records what was posted, replies when told to. */
function makeFakeWorker() {
  const worker = {
    posted: [],
    terminated: 0,
    onmessage: null,
    postMessage(data) { this.posted.push(data); },
    terminate() { this.terminated++; },
    reply(message) { this.onmessage({ data: message }); },
  };
  return worker;
}

const board = () => makeBoard(['#####', '#@$.#', '#####']);

test('the snapshot posted is plain data a worker can clone', () => {
  const worker = makeFakeWorker();
  const service = new HintService({ createWorker: () => worker });

  service.requestHint(board());

  const { snapshot } = worker.posted[0];
  assert.equal(snapshot.width, 5);
  assert.equal(snapshot.height, 3);
  assert.deepEqual(snapshot.player, { x: 1, y: 1 });
  assert.deepEqual(snapshot.boxes, [{ x: 2, y: 1 }], 'a Set would not survive the clone');
  assert.equal(Array.isArray(snapshot.statics), true);
});

test('the reply carrying the matching id resolves the promise', async () => {
  const worker = makeFakeWorker();
  const service = new HintService({ createWorker: () => worker });

  const pending = service.requestHint(board());
  const { id } = worker.posted[0];
  worker.reply({ id, hint: { box: { x: 2, y: 1 }, dir: Direction.Right } });

  assert.deepEqual(await pending, { box: { x: 2, y: 1 }, dir: Direction.Right });
});

test('a worker that found nothing resolves to null, not a rejection', async () => {
  const worker = makeFakeWorker();
  const service = new HintService({ createWorker: () => worker });

  const pending = service.requestHint(board());
  worker.reply({ id: worker.posted[0].id, hint: null });

  assert.equal(await pending, null);
});

test('a new request supersedes the one still running', async () => {
  const worker = makeFakeWorker();
  const service = new HintService({ createWorker: () => worker });

  const first = service.requestHint(board());
  const second = service.requestHint(board());

  assert.equal(await first, null, 'the superseded request must not hang forever');

  // A late answer to the abandoned request must not leak into the live one.
  worker.reply({ id: worker.posted[0].id, hint: { box: { x: 9, y: 9 }, dir: Direction.Up } });
  worker.reply({ id: worker.posted[1].id, hint: { box: { x: 2, y: 1 }, dir: Direction.Right } });

  assert.deepEqual(await second, { box: { x: 2, y: 1 }, dir: Direction.Right });
});

test('an error from the worker resolves to null and does not reject', async () => {
  const worker = makeFakeWorker();
  const service = new HintService({ createWorker: () => worker });

  const pending = service.requestHint(board());
  worker.reply({ id: worker.posted[0].id, error: 'boom' });

  assert.equal(await pending, null);
});

test('a browser that cannot build the worker still answers, on the main thread', async () => {
  const service = new HintService({
    createWorker: () => { throw new Error('module workers not supported'); },
  });

  assert.deepEqual(await service.requestHint(board()), {
    box: { x: 2, y: 1 }, dir: Direction.Right,
  });
});

test('the main-thread fallback passes the small budget to the solver, not the default', async () => {
  let receivedBudget;
  const service = new HintService({
    createWorker: () => { throw new Error('module workers not supported'); },
    solve: (snapshot, budget) => { receivedBudget = budget; return null; },
  });

  await service.requestHint(board());

  // Catches the regression a dropped second argument would cause: solveNextPush would
  // silently fall back to its own 150 000-node default, which is exactly what would
  // freeze a player's tab when there is no worker to absorb it.
  assert.deepEqual(receivedBudget, { maxNodes: 20_000, maxMs: 1_500 });
});

test('a solver that throws on the main thread resolves to null instead of crashing the caller', async () => {
  const service = new HintService({
    createWorker: () => { throw new Error('module workers not supported'); },
    solve: () => { throw new Error('boom'); },
  });

  // Must not throw synchronously here: `Promise.resolve(this.#solve(...))` evaluates
  // its argument before Promise.resolve is even called, so an unguarded throw would
  // escape requestHint() itself rather than merely rejecting the returned promise.
  const pending = service.requestHint(board());

  assert.equal(await pending, null);
});

test('a worker whose postMessage throws resolves to null rather than an auto-rejected promise', async () => {
  const worker = makeFakeWorker();
  worker.postMessage = () => { throw new Error('DataCloneError'); };
  const service = new HintService({ createWorker: () => worker });

  // A plain assert.doesNotReject would not tell an unfixed promise apart from one that
  // resolves to the wrong value, so assert the actual resolution.
  const result = await service.requestHint(board());

  assert.equal(result, null);
});

test('dispose shuts the worker down', () => {
  const worker = makeFakeWorker();
  const service = new HintService({ createWorker: () => worker });
  service.requestHint(board());

  service.dispose();

  assert.equal(worker.terminated, 1);
});
