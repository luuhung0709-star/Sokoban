import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsPanel } from '../src/ui/settingsPanel.js';
import { makeElement, withId } from './fakeDom.mjs';

/**
 * Stands in for `window`. The fake DOM has no real propagation, so the target records
 * whether stopPropagation was called and the assertions read that.
 *
 * The capture flag is part of a listener's identity: removing with the wrong flag
 * silently fails in the real DOM. This fake models that to catch leaks a real browser would expose.
 */
function makeKeyTarget() {
  const handlers = [];
  return {
    addEventListener(type, fn, capture) {
      if (type === 'keydown') handlers.push({ fn, capture });
    },
    removeEventListener(type, fn, capture) {
      // The real DOM treats the capture flag as part of a listener's identity: remove
      // with the wrong flag and the listener silently stays registered. Model that, or
      // the fake would certify a leak-free hide() that leaks in a browser.
      const i = handlers.findIndex((h) => h.fn === fn && h.capture === capture);
      if (i >= 0) handlers.splice(i, 1);
    },
    get handlerCount() { return handlers.length; },
    get captureFlags() { return handlers.map((h) => h.capture); },
    press(code) {
      const event = { code, stopped: false, stopPropagation() { this.stopped = true; } };
      for (const h of [...handlers]) h.fn(event);
      return event;
    },
  };
}

/**
 * The whole sheet in one go, including the parts Task 2 and Task 3 wire up. Ids the
 * constructor does not look up yet are inert, and building this once beats rewriting it
 * three times.
 */
function setup({ playing = true } = {}) {
  const root = makeElement('div');
  for (const id of ['btn-music', 'btn-sfx', 'btn-tutorial', 'btn-settings-back',
                    'btn-settings-close', 'btn-settings-restart']) {
    root.append(withId(id, 'button'));
  }
  for (const id of ['settings-list', 'settings-tutorial', 'row-restart']) {
    root.append(withId(id, 'div'));
  }
  root.append(withId('settings-title', 'h2'));
  root.hidden = true;

  const state = { musicOn: true, sfxOn: true, playing };
  const fired = [];
  const keyTarget = makeKeyTarget();

  const panel = new SettingsPanel(root, {
    onToggleMusic: () => { state.musicOn = !state.musicOn; fired.push('music'); },
    onToggleSfx: () => { state.sfxOn = !state.sfxOn; fired.push('sfx'); },
    onRestart: () => { fired.push('restart'); },
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

test('the switches report the stored settings through aria-pressed', () => {
  const { panel, state, el } = setup();

  panel.show();
  assert.equal(el('btn-music').getAttribute('aria-pressed'), 'true');

  state.musicOn = false;
  panel.refresh();
  assert.equal(el('btn-music').getAttribute('aria-pressed'), 'false');
});

test('the full name goes to screen readers, since the visible label is shortened', () => {
  const { panel, state, el } = setup();
  state.sfxOn = false;

  panel.show();

  assert.equal(el('btn-sfx').getAttribute('aria-label'), 'Sound effects: off');
  assert.equal(el('btn-music').getAttribute('aria-label'), 'Music: on',
    'one switch must not follow the other');
});

test('the visible label is static markup, so refresh must leave it alone', () => {
  const { panel, el } = setup();
  el('btn-music').textContent = 'Music';

  panel.show();

  assert.equal(el('btn-music').textContent, 'Music',
    'the icon and label live in index.html now; rewriting them here would wipe the icon');
});

test('pressing a switch fires its callback and redraws', () => {
  const { panel, fired, el } = setup();
  panel.show();

  el('btn-music').dispatch('click');

  assert.deepEqual(fired, ['music']);
  assert.equal(el('btn-music').getAttribute('aria-pressed'), 'false',
    'the state follows immediately');
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

test('the key listener goes on in the capture phase, ahead of the game router', () => {
  const { panel, keyTarget } = setup();

  panel.show();

  assert.deepEqual(keyTarget.captureFlags, [true],
    'InputRouter listens on window in the bubble phase, so only a capture listener runs first');
});

test('the panel opens on the list, not on the tutorial', () => {
  const { panel, el } = setup();

  panel.show();

  assert.equal(el('settings-list').hidden, false);
  assert.equal(el('settings-tutorial').hidden, true);
  assert.equal(el('settings-title').textContent, 'Settings');
  assert.equal(el('btn-settings-back').hidden, true, 'there is nothing to go back to');
});

test('the Tutorial row swaps in the tutorial view', () => {
  const { panel, el } = setup();
  panel.show();

  el('btn-tutorial').dispatch('click');

  assert.equal(el('settings-list').hidden, true);
  assert.equal(el('settings-tutorial').hidden, false);
  assert.equal(el('settings-title').textContent, 'How to play');
  assert.equal(el('btn-settings-back').hidden, false);
});

test('back returns to the list without closing the panel', () => {
  const { root, panel, el } = setup();
  panel.show();
  el('btn-tutorial').dispatch('click');

  el('btn-settings-back').dispatch('click');

  assert.equal(el('settings-list').hidden, false);
  assert.equal(el('settings-tutorial').hidden, true);
  assert.equal(root.hidden, false, 'back is one step, not a close');
});

test('Escape in the tutorial goes back a step instead of closing', () => {
  const { root, panel, keyTarget, el } = setup();
  panel.show();
  el('btn-tutorial').dispatch('click');

  const event = keyTarget.press('Escape');

  assert.equal(el('settings-list').hidden, false);
  assert.equal(root.hidden, false);
  assert.equal(event.stopped, true, 'the router below must never see this Escape');
});

test('reopening after closing from the tutorial lands on the list', () => {
  const { panel, el } = setup();
  panel.show();
  el('btn-tutorial').dispatch('click');
  panel.hide();

  panel.show();

  assert.equal(el('settings-list').hidden, false,
    'a stale view would strand the player in the tutorial');
});
