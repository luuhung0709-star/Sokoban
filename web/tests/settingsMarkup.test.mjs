import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * SettingsPanel finds its parts by id, and every other test hands it a fake DOM — so
 * nothing would notice an id renamed in the JS but not in index.html. The panel would
 * throw on the first line of its constructor, in a browser, and nowhere else. This is
 * the one test that reads the real markup.
 */
const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

const REQUIRED_IDS = [
  'settings', 'settings-list', 'settings-tutorial', 'settings-title',
  'btn-music', 'btn-sfx', 'btn-tutorial',
  'btn-settings-back', 'btn-settings-close', 'btn-settings-restart', 'row-restart',
];

for (const id of REQUIRED_IDS) {
  test(`index.html carries #${id}`, () => {
    assert.ok(html.includes(`id="${id}"`), 'SettingsPanel looks this id up and cannot start without it');
  });
}

test('the switch labels are not hard-coded with a state in them', () => {
  assert.equal(html.includes('Sound effects: on'), false,
    'state comes from aria-pressed now; a hard-coded label would show the wrong one on load');
});
