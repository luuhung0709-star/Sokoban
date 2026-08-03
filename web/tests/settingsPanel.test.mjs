import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsPanel } from '../src/ui/settingsPanel.js';
import { makeElement, withId } from './fakeDom.mjs';

/**
 * Stands in for `window`. The fake DOM has no real propagation, so the target records
 * whether stopPropagation was called and the assertions read that.
 */
function makeKeyTarget() {
  const handlers = [];
  return {
    addEventListener(type, fn) { if (type === 'keydown') handlers.push(fn); },
    removeEventListener(type, fn) {
      const i = handlers.indexOf(fn);
      if (i >= 0) handlers.splice(i, 1);
    },
    get handlerCount() { return handlers.length; },
    press(code) {
      const event = { code, stopped: false, stopPropagation() { this.stopped = true; } };
      for (const fn of [...handlers]) fn(event);
      return event;
    },
  };
}

function setup() {
  const root = makeElement('div');
  for (const id of ['btn-music', 'btn-sfx', 'btn-settings-close']) {
    root.append(withId(id, 'button'));
  }
  root.hidden = true;

  const state = { musicOn: true, sfxOn: true };
  const fired = [];
  const keyTarget = makeKeyTarget();

  const panel = new SettingsPanel(root, {
    onToggleMusic: () => { state.musicOn = !state.musicOn; fired.push('music'); },
    onToggleSfx: () => { state.sfxOn = !state.sfxOn; fired.push('sfx'); },
    getState: () => state,
    keyTarget,
  });

  return { root, panel, state, fired, keyTarget, el: (id) => root.querySelector(`#${id}`) };
}

test('show reveals the panel and hide puts it away', () => {
  const { root, panel } = setup();

  panel.show();
  assert.equal(root.hidden, false);

  panel.hide();
  assert.equal(root.hidden, true);
});

test('the labels report the stored settings', () => {
  const { panel, state, el } = setup();

  panel.show();
  assert.equal(el('btn-music').textContent, 'Music: on');
  assert.equal(el('btn-music').getAttribute('aria-pressed'), 'true');

  state.musicOn = false;
  panel.refresh();
  assert.equal(el('btn-music').textContent, 'Music: off');
  assert.equal(el('btn-music').getAttribute('aria-pressed'), 'false');
});

test('the effects switch has its own label', () => {
  const { panel, state, el } = setup();
  state.sfxOn = false;

  panel.show();

  assert.equal(el('btn-sfx').textContent, 'Sound effects: off');
  assert.equal(el('btn-music').textContent, 'Music: on', 'one switch must not follow the other');
});

test('pressing a switch fires its callback and redraws', () => {
  const { panel, fired, el } = setup();
  panel.show();

  el('btn-music').dispatch('click');

  assert.deepEqual(fired, ['music']);
  assert.equal(el('btn-music').textContent, 'Music: off', 'the label follows immediately');
});

test('Close puts the panel away', () => {
  const { root, panel, el } = setup();
  panel.show();

  el('btn-settings-close').dispatch('click');

  assert.equal(root.hidden, true);
});

test('Escape closes the panel instead of leaving the level', () => {
  const { root, panel, keyTarget } = setup();
  panel.show();

  const event = keyTarget.press('Escape');

  assert.equal(root.hidden, true);
  assert.equal(event.stopped, true, 'the router below must never see this Escape');
});

test('game keys are swallowed while the panel is up', () => {
  const { panel, keyTarget } = setup();
  panel.show();

  assert.equal(keyTarget.press('ArrowRight').stopped, true,
    'the player must not walk about behind the overlay');
});

test('closing takes the key listener back off', () => {
  const { panel, keyTarget } = setup();

  panel.show();
  assert.equal(keyTarget.handlerCount, 1);

  panel.hide();
  assert.equal(keyTarget.handlerCount, 0, 'a listener left behind would swallow keys forever');
});

test('showing twice leaves one listener, not two', () => {
  const { panel, keyTarget } = setup();

  panel.show();
  panel.show();

  assert.equal(keyTarget.handlerCount, 1);
});
