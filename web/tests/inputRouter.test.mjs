import test from 'node:test';
import assert from 'node:assert/strict';
import { InputRouter, Command } from '../src/input/inputRouter.js';
import { makeElement, installDocument } from './fakeDom.mjs';

// onKeyDown reads document.body.dataset.screen to decide whether to block scrolling.
installDocument();

/** A keydown event with just the fields InputRouter reads. */
function keydown(code) {
  return { code, repeat: false, preventDefault() {} };
}

function setup() {
  const target = makeElement('window');   // any fake with addEventListener/dispatch will do
  const router = new InputRouter(target);
  const commands = [];
  router.onCommand((command) => commands.push(command));
  router.attach();
  return { target, commands };
}

test('KeyH emits nothing — the hint feature was removed', () => {
  const { target, commands } = setup();

  target.dispatch('keydown', keydown('KeyH'));

  assert.deepEqual(commands, []);
});

test('KeyU emits Command.Undo', () => {
  const { target, commands } = setup();

  target.dispatch('keydown', keydown('KeyU'));

  assert.deepEqual(commands, [Command.Undo]);
});

test('KeyY emits nothing — Redo was removed from this branch', () => {
  const { target, commands } = setup();

  target.dispatch('keydown', keydown('KeyY'));

  assert.deepEqual(commands, []);
});

test('an unmapped key emits nothing', () => {
  const { target, commands } = setup();

  target.dispatch('keydown', keydown('KeyZ'));

  assert.deepEqual(commands, []);
});
