# Settings dạng sheet, thêm Tutorial và Restart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại overlay Settings thành một sheet có hàng và đường kẻ theo ảnh mẫu, thêm khung Tutorial và nút Restart (chỉ hiện khi đang chơi).

**Architecture:** Vẫn một overlay `#settings` ở cấp `<body>`, nhưng bên trong chia hai `.sheet__view` — list và tutorial — và `SettingsPanel` bật/tắt `hidden` giữa hai khung. Trạng thái công tắc chuyển từ `textContent` sang `aria-pressed`, để CSS vẽ trạng thái từ đúng thuộc tính mà trình đọc màn hình đọc. Chú giải ô trong Tutorial dùng lại nguyên class của bàn cờ (`.tile--wall`, `.tile--goal`, `.actor--box`) nên không bao giờ lệch với thứ người chơi thấy thật.

**Tech Stack:** HTML + CSS + JavaScript thuần, ES module, không build step. Test bằng `node --test`.

## Global Constraints

- **Không thêm dependency.** `web/package.json` không có `dependencies` lẫn `devDependencies`, và đó là lý do game không cần build step.
- **Chữ trên giao diện là tiếng Anh.** Comment trong code cũng tiếng Anh. Chỉ plan và spec là tiếng Việt.
- **Chính tả Anh-Anh trong comment** (`colour`, `neighbour`, `normalise`, `centring`) — khớp code đang có.
- **Comment giải thích *tại sao*, không phải *cái gì*.**
- Test chạy bằng `cd web && npm test`. Chạy một file: `cd web && node --test tests/<file>.mjs`.
- Không dùng jsdom. View-layer test dùng `web/tests/fakeDom.mjs`.
- Commit sau mỗi task, message tiếng Việt, một dòng tiêu đề dưới 72 ký tự.
- Nhánh làm việc: `hint-settings`. Thư mục gốc: `d:/Hung/Sokoban`.

---

## File Structure

**Tạo mới**

| File | Trách nhiệm |
|---|---|
| `web/tests/settingsMarkup.test.mjs` | Kiểm `index.html` có đủ mọi id mà `SettingsPanel` tra cứu. Là test duy nhất đọc markup thật. |

**Sửa**

| File | Vì sao |
|---|---|
| `web/src/ui/settingsPanel.js` | Hai khung nhìn, hàng Restart, công tắc chuyển sang `aria-pressed`. |
| `web/tests/settingsPanel.test.mjs` | Theo các thay đổi trên. |
| `web/index.html` | Markup sheet mới; rút gọn dòng phím tắt ở menu. |
| `web/src/main.js` | Truyền `onRestart` và `playing`. |
| `web/styles/ui.css` | Kiểu cho sheet, hàng, công tắc, chú giải, bảng phím. |

---

### Task 1: Công tắc vẽ trạng thái từ `aria-pressed`

**Files:**
- Modify: `web/src/ui/settingsPanel.js:56-60`, `:73-76`
- Test: `web/tests/settingsPanel.test.mjs:36-55`, `:67-98`

**Interfaces:**
- Consumes: không có.
- Produces: `refresh()` đặt `aria-pressed` (`'true'`/`'false'`) và `aria-label` (`'Music: on'`, `'Sound effects: off'`, …) lên `#btn-music` và `#btn-sfx`, và **không** đụng `textContent` của chúng nữa.

- [ ] **Step 1: Thay `setup()` bằng bản đầy đủ cho cả ba task**

Trong `web/tests/settingsPanel.test.mjs`, thay hàm `setup()` (dòng 36-55) bằng:

```js
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
```

- [ ] **Step 2: Thay ba test đọc `textContent` bằng test đọc `aria-*`**

Trong cùng file, thay ba test ở dòng 67-98 (`'the labels report the stored settings'`, `'the effects switch has its own label'`, `'pressing a switch fires its callback and redraws'`) bằng bốn test sau:

```js
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
```

- [ ] **Step 3: Chạy test, phải thấy đỏ**

Run: `cd web && node --test tests/settingsPanel.test.mjs`
Expected: FAIL ở `'the visible label is static markup'` — `label()` hiện vẫn ghi đè `textContent` thành `'Music: on'`. Cũng FAIL ở test `aria-label` vì thuộc tính đó chưa được đặt. Ghi lại thông báo lỗi.

- [ ] **Step 4: Sửa `refresh` và hàm `label`**

Trong `web/src/ui/settingsPanel.js`, thay `refresh()` (dòng 56-60) bằng:

```js
  refresh() {
    const { musicOn, sfxOn } = this.#getState();
    setSwitch(this.#musicBtn, 'Music', musicOn);
    setSwitch(this.#sfxBtn, 'Sound effects', sfxOn);
  }
```

Và thay hàm `label` ở cuối file (dòng 73-76) bằng:

```js
/**
 * State goes on `aria-pressed` alone, and the CSS draws the switch from that attribute.
 * One source of truth: a separate class for the look could drift out of step with what a
 * screen reader announces.
 *
 * The visible label is static markup — it carries an icon, and it is shortened to fit
 * half a row — so the full name is spelled out here instead.
 */
function setSwitch(button, name, on) {
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', `${name}: ${on ? 'on' : 'off'}`);
}
```

- [ ] **Step 5: Chạy lại, phải xanh**

Run: `cd web && node --test tests/settingsPanel.test.mjs`
Expected: PASS, 11 test.

- [ ] **Step 6: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ, 232 test.

- [ ] **Step 7: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/ui/settingsPanel.js web/tests/settingsPanel.test.mjs
git commit -m "SettingsPanel: công tắc vẽ trạng thái từ aria-pressed"
```

---

### Task 2: Hai khung nhìn — list và tutorial

**Files:**
- Modify: `web/src/ui/settingsPanel.js`
- Test: `web/tests/settingsPanel.test.mjs`

**Interfaces:**
- Consumes: `setSwitch` và `refresh()` (Task 1).
- Produces: `SettingsPanel` tra cứu thêm bốn id — `#settings-list`, `#settings-tutorial`, `#settings-title`, `#btn-settings-back` — và bind `#btn-tutorial`. `show()` luôn mở ở khung list. `onKeyDown` xử `Escape` theo khung đang mở.

- [ ] **Step 1: Viết test đỏ**

Thêm vào cuối `web/tests/settingsPanel.test.mjs`:

```js
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
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/settingsPanel.test.mjs`
Expected: FAIL ở `'the panel opens on the list'` — `#settings-list` chưa được ai đụng tới nên `hidden` vẫn là `false` mặc định, còn `#settings-tutorial` cũng `false` thay vì `true`.

- [ ] **Step 3: Thêm bốn field và phần bind vào constructor**

Trong `web/src/ui/settingsPanel.js`, thêm bốn field ngay sau `#sfxBtn;`:

```js
  #listView;
  #tutorialView;
  #title;
  #backBtn;
```

Và thêm `#onTutorial = false;` ngay sau `#open = false;`.

Trong constructor, thêm ngay sau dòng `this.#sfxBtn = rootEl.querySelector('#btn-sfx');`:

```js
    this.#listView = rootEl.querySelector('#settings-list');
    this.#tutorialView = rootEl.querySelector('#settings-tutorial');
    this.#title = rootEl.querySelector('#settings-title');
    this.#backBtn = rootEl.querySelector('#btn-settings-back');
```

Và thêm ngay trước dòng bind `#btn-settings-close`:

```js
    rootEl.querySelector('#btn-tutorial').addEventListener('click', () => this.#setView(true));
    this.#backBtn.addEventListener('click', () => this.#setView(false));
```

- [ ] **Step 4: Sửa `show()` và thêm `#setView`**

Đổi `show()` thành — thêm đúng một dòng ở đầu:

```js
  show() {
    // Always open on the list. Closing the panel from the tutorial and opening it again
    // must not drop the player back into the middle of it.
    this.#setView(false);
    this.refresh();
    this.#root.hidden = false;

    // Guard against a second show: addEventListener would take the same function twice
    // and every key would be handled twice over.
    if (this.#open) return;
    this.#open = true;
    this.#keyTarget.addEventListener('keydown', this.onKeyDown, true);
  }
```

Thêm method riêng, đặt ngay sau `refresh()`:

```js
  /**
   * Swaps the two views. Both live in the same overlay so the sheet keeps its frame,
   * its key handling and its close button across the switch — a second overlay would
   * have to duplicate all three.
   */
  #setView(onTutorial) {
    this.#onTutorial = onTutorial;
    this.#listView.hidden = onTutorial;
    this.#tutorialView.hidden = !onTutorial;
    this.#backBtn.hidden = !onTutorial;
    this.#title.textContent = onTutorial ? 'How to play' : 'Settings';
  }
```

- [ ] **Step 5: Sửa `onKeyDown`**

Đổi `onKeyDown` thành:

```js
  /**
   * Registered on the CAPTURE phase, so it runs before InputRouter's listener on the same
   * window and can stop it. Without this the arrow keys would walk the player about
   * behind the overlay, and Escape would leave the level rather than close the panel.
   */
  onKeyDown(event) {
    event.stopPropagation();
    if (event.code !== 'Escape') return;

    // Escape means "back one step", not "close": from the tutorial it returns to the
    // list, and only from the list does it put the panel away.
    if (this.#onTutorial) this.#setView(false);
    else this.hide();
  }
```

- [ ] **Step 6: Chạy, phải xanh**

Run: `cd web && node --test tests/settingsPanel.test.mjs`
Expected: PASS, 16 test.

- [ ] **Step 7: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ, 237 test.

- [ ] **Step 8: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/ui/settingsPanel.js web/tests/settingsPanel.test.mjs
git commit -m "SettingsPanel: tách khung list và khung tutorial"
```

---

### Task 3: Hàng Restart

**Files:**
- Modify: `web/src/ui/settingsPanel.js`
- Test: `web/tests/settingsPanel.test.mjs`

**Interfaces:**
- Consumes: `#setView` và `refresh()` (Task 1, Task 2).
- Produces: constructor nhận thêm `onRestart` trong object tuỳ chọn và bind `#btn-settings-restart`. `getState()` phải trả thêm `playing: boolean`. `refresh()` đặt `#row-restart.hidden = !playing`.

- [ ] **Step 1: Viết test đỏ**

Thêm vào cuối `web/tests/settingsPanel.test.mjs`:

```js
test('the Restart row is gone when no level is being played', () => {
  const { panel, el } = setup({ playing: false });

  panel.show();

  assert.equal(el('row-restart').hidden, true,
    'there is nothing to restart from the menu');
});

test('the Restart row is there while a level is up', () => {
  const { panel, el } = setup({ playing: true });

  panel.show();

  assert.equal(el('row-restart').hidden, false);
});

test('the row follows a change of screen on the next refresh', () => {
  const { panel, state, el } = setup({ playing: true });
  panel.show();

  state.playing = false;
  panel.refresh();

  assert.equal(el('row-restart').hidden, true);
});

test('Restart replays the level', () => {
  const { panel, fired, el } = setup({ playing: true });
  panel.show();

  el('btn-settings-restart').dispatch('click');

  assert.deepEqual(fired, ['restart']);
});

test('Restart also closes the panel', () => {
  const { root, panel, el } = setup({ playing: true });
  panel.show();

  el('btn-settings-restart').dispatch('click');

  assert.equal(root.hidden, true,
    'leaving it open would show the reset board through an overlay');
});
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/settingsPanel.test.mjs`
Expected: FAIL ở `'the Restart row is gone when no level is being played'` — `#row-restart` chưa được ai đụng tới nên `hidden` vẫn là `false`.

- [ ] **Step 3: Thêm field và bind**

Trong `web/src/ui/settingsPanel.js`, thêm field `#restartRow;` ngay sau `#backBtn;`.

Đổi dòng khai báo tham số của constructor thành:

```js
  constructor(rootEl, { onToggleMusic, onToggleSfx, onRestart, getState, keyTarget = window }) {
```

Thêm ngay sau dòng gán `this.#backBtn = ...`:

```js
    this.#restartRow = rootEl.querySelector('#row-restart');
```

Thêm ngay sau dòng bind `#btn-settings-close`:

```js
    rootEl.querySelector('#btn-settings-restart').addEventListener('click', () => {
      onRestart();
      this.hide();
    });
```

- [ ] **Step 4: Đặt `hidden` trong `refresh`**

Đổi `refresh()` thành:

```js
  refresh() {
    const { musicOn, sfxOn, playing } = this.#getState();
    setSwitch(this.#musicBtn, 'Music', musicOn);
    setSwitch(this.#sfxBtn, 'Sound effects', sfxOn);

    // Nothing to restart from the menu. The row goes away rather than sitting there
    // greyed out: a dead button invites a click that does nothing.
    this.#restartRow.hidden = !playing;
  }
```

- [ ] **Step 5: Chạy, phải xanh**

Run: `cd web && node --test tests/settingsPanel.test.mjs`
Expected: PASS, 21 test.

- [ ] **Step 6: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ, 242 test.

- [ ] **Step 7: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/ui/settingsPanel.js web/tests/settingsPanel.test.mjs
git commit -m "SettingsPanel: hàng Restart, chỉ hiện khi đang chơi"
```

---

### Task 4: Markup và nối dây

**Files:**
- Modify: `web/index.html:15`, `:67-76`
- Modify: `web/src/main.js:67-71`
- Create: `web/tests/settingsMarkup.test.mjs`

**Interfaces:**
- Consumes: mọi id `SettingsPanel` tra cứu (Task 1-3).
- Produces: `#settings` có đủ `#settings-list`, `#settings-tutorial`, `#settings-title`, `#btn-settings-back`, `#btn-tutorial`, `#btn-settings-restart`, `#row-restart`. `main.js` truyền `onRestart` và `playing`.

- [ ] **Step 1: Viết test đỏ cho markup**

Tạo `web/tests/settingsMarkup.test.mjs`:

```js
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
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/settingsMarkup.test.mjs`
Expected: FAIL 8 test — markup hiện chỉ có `#settings`, `#btn-music`, `#btn-sfx`, `#btn-settings-close`, nên bảy id còn lại đỏ; test cuối cũng đỏ vì `index.html:72` còn chuỗi `Sound effects: on`.

- [ ] **Step 3: Thay markup của overlay Settings**

Trong `web/index.html`, thay toàn bộ khối dòng 67-76 bằng:

```html
  <div class="overlay overlay--modal" id="settings" hidden>
    <div class="panel panel--sheet">
      <header class="sheet__head">
        <button class="sheet__nav" id="btn-settings-back" type="button" aria-label="Back" hidden>‹</button>
        <h2 class="sheet__title" id="settings-title">Settings</h2>
        <button class="sheet__nav" id="btn-settings-close" type="button" aria-label="Close">✕</button>
      </header>

      <div class="sheet__view" id="settings-list">
        <div class="row row--pair">
          <button class="switch" id="btn-sfx" type="button" aria-pressed="true">
            <span class="switch__icon" aria-hidden="true">🔊</span>
            <span>Sounds</span>
          </button>
          <button class="switch" id="btn-music" type="button" aria-pressed="true">
            <span class="switch__icon" aria-hidden="true">🎵</span>
            <span>Music</span>
          </button>
        </div>

        <button class="row row--nav" id="btn-tutorial" type="button">
          <span class="row__icon" aria-hidden="true">📖</span>
          <span>Tutorial</span>
          <span class="row__chevron" aria-hidden="true">›</span>
        </button>

        <div class="sheet__foot" id="row-restart">
          <button class="btn btn--big" id="btn-settings-restart" type="button">Restart</button>
        </div>
      </div>

      <div class="sheet__view" id="settings-tutorial" hidden>
        <p class="sheet__text">Push every box onto a goal. You can only push a box — never pull it.</p>

        <ul class="legend">
          <li class="legend__item">
            <i class="legend__cell"><i class="tile tile--wall"></i></i>
            <span>Wall</span>
          </li>
          <li class="legend__item">
            <i class="legend__cell"><i class="tile tile--floor tile--goal"></i></i>
            <span>Goal</span>
          </li>
          <li class="legend__item">
            <i class="legend__cell">
              <i class="tile tile--floor"></i>
              <span class="actor actor--box"><i class="actor__face"></i></span>
            </i>
            <span>Box</span>
          </li>
          <li class="legend__item">
            <i class="legend__cell">
              <i class="tile tile--floor tile--goal"></i>
              <span class="actor actor--box actor--on-goal"><i class="actor__face"></i></span>
            </i>
            <span>Box on a goal</span>
          </li>
        </ul>

        <dl class="keys">
          <dt>← ↑ → ↓ / WASD</dt><dd>move</dd>
          <dt>U</dt><dd>undo</dd>
          <dt>H</dt><dd>hint</dd>
          <dt>R</dt><dd>restart level</dd>
          <dt>Esc</dt><dd>exit</dd>
        </dl>
      </div>
    </div>
  </div>
```

- [ ] **Step 4: Rút gọn dòng phím tắt ở menu**

Bảng phím đầy đủ giờ nằm trong Tutorial. Để nguyên cả hai chỗ là hai bản sao sẽ lệch nhau. Đổi `web/index.html:15` thành:

```html
      <p class="panel__hint">Push every box onto a goal · Settings → Tutorial for the keys</p>
```

- [ ] **Step 5: Chạy, phải xanh**

Run: `cd web && node --test tests/settingsMarkup.test.mjs`
Expected: PASS, 12 test.

- [ ] **Step 6: Nối `onRestart` và `playing` ở main.js**

Trong `web/src/main.js`, thay khối `settings:` (dòng 67-71) bằng:

```js
  settings: new SettingsPanel(document.getElementById('settings'), {
    onToggleMusic: () => { audio.musicOn = !audio.musicOn; },
    onToggleSfx: () => { audio.sfxOn = !audio.sfxOn; },
    onRestart: () => flow.retryLevel(),
    // `dataset.screen` is what GameFlow already writes on every screen change, so the
    // panel reads the same source of truth rather than keeping a flag of its own to
    // fall out of step.
    getState: () => ({
      musicOn: audio.musicOn,
      sfxOn: audio.sfxOn,
      playing: document.body.dataset.screen === 'play',
    }),
  }),
```

`flow` được khai báo bên dưới `panels`, nhưng `onRestart` chỉ chạy khi người dùng bấm — lúc đó `const flow` đã khởi tạo xong. Cùng kiểu closure mà `onContinue` và `onSelect` ngay phía trên đang dùng.

- [ ] **Step 7: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ, 254 test.

- [ ] **Step 8: Commit**

```bash
cd d:/Hung/Sokoban
git add web/index.html web/src/main.js web/tests/settingsMarkup.test.mjs
git commit -m "Markup sheet cho Settings, nối Restart và cờ playing"
```

---

### Task 5: CSS

**Files:**
- Modify: `web/styles/ui.css` (thêm vào cuối file)

**Interfaces:**
- Consumes: các class trong markup của Task 4.
- Produces: không có API nào. Đây là task duy nhất không có test tự động — CSS không kiểm được nếu không có trình duyệt. Phần kiểm tay ở cuối plan là cách xác minh.

- [ ] **Step 1: Thêm kiểu cho sheet**

Thêm vào cuối `web/styles/ui.css`:

```css
/*
 * The settings sheet. Rows run edge to edge with a hairline between them, so `.panel`'s
 * side padding and centred text both have to go — but only here: the main menu and the
 * level-complete overlay share `.panel` and still need them. This block sits at the end
 * of the file so a single class selector is enough to win over `.panel` above.
 */
.panel--sheet {
  width: min(360px, 92vw);
  max-width: none;
  padding: 0;
  text-align: left;
  overflow: hidden;      /* so the rounded corners clip the first and last row */
}

/*
 * Three fixed columns rather than flex with a spacer: the title stays centred on the
 * sheet whether or not the back button is showing. With flex it would slide sideways
 * every time the view changed.
 */
.sheet__head {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  padding: 10px 8px;
  border-bottom: 1px solid var(--panel-line);
}

.sheet__title { margin: 0; font-size: 18px; text-align: center; }

.sheet__nav {
  padding: 4px;
  border: 0;
  background: none;
  color: var(--text-dim);
  font: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.sheet__nav:hover { color: var(--text); }

/*
 * The tutorial view is taller than the list, and on a phone held sideways it would run
 * off the bottom of the sheet with no way to reach the rest.
 */
.sheet__view {
  max-height: 70vh;
  overflow-y: auto;
}

/*
 * `hidden` only means `display: none` while nothing else sets `display`. Every rule here
 * that does is listed, so a view or a row toggled from JS really disappears.
 */
.sheet__view[hidden], .sheet__nav[hidden], .sheet__foot[hidden] { display: none; }
```

- [ ] **Step 2: Thêm kiểu cho hàng và công tắc**

Thêm tiếp:

```css
.row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-top: 1px solid var(--panel-line);
  background: none;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.row:first-child { border-top: 0; }
.row--nav:hover { background: rgba(255, 255, 255, 0.04); }
.row__icon { font-size: 20px; }
.row__chevron { color: var(--text-dim); font-size: 18px; }

/* Two switches sharing one row, split down the middle. */
.row--pair {
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 0;
  cursor: default;
}

.switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 8px;
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
}

.switch + .switch { border-left: 1px solid var(--panel-line); }

/*
 * Off state, keyed off the same attribute a screen reader reads.
 *
 * `opacity` rather than `color` for the dimming: the icon is an emoji, and emoji glyphs
 * carry their own colours and ignore `color` entirely. Opacity is the one property that
 * fades both the emoji and the word beside it.
 */
.switch[aria-pressed="false"] {
  opacity: 0.45;
  color: var(--text);
}

.switch__icon { position: relative; font-size: 20px; line-height: 1; }

/*
 * The slash. Drawn here rather than swapping in 🔇: that glyph looks different on every
 * system, and being a colour emoji it could not be dimmed to match the label.
 */
.switch[aria-pressed="false"] .switch__icon::after {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: 50%;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transform: rotate(-45deg);
}

.sheet__foot {
  padding: 14px 16px;
  border-top: 1px solid var(--panel-line);
}

.sheet__foot .btn { width: 100%; }
```

- [ ] **Step 3: Thêm kiểu cho khung Tutorial**

Thêm tiếp:

```css
.sheet__text { margin: 0; padding: 16px; color: var(--text-dim); font-size: 14px; }

.legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;
  padding: 0 16px 16px;
  list-style: none;
}

.legend__item { display: flex; align-items: center; gap: 10px; font-size: 13px; }

/*
 * One board square, borrowed whole from the game so the key can never drift from what
 * the player actually sees. Two things have to be re-established out here:
 *
 * `--cell` and `--stroke`, because they are declared on `.board`, not on `:root` — the
 * formula is copied from board.css and must stay in step with it.
 *
 * A positioned parent, because `.actor` is `position: absolute` and normally sits inside
 * `.board__actors`. Without this the box would escape to the nearest positioned ancestor
 * and land somewhere across the sheet.
 */
.legend__cell {
  --cell: 30px;
  --stroke: calc(var(--cell) * 0.06);
  position: relative;
  flex: none;
  width: var(--cell);
  height: var(--cell);
}

/*
 * `.tile` is an <i>, and it never declares a `display` of its own — on the board it is a
 * grid item, which blockifies it. Out here there is no grid, so an inline <i> would
 * ignore the width and height entirely and the sample would collapse to nothing.
 */
.legend__cell .tile { display: block; }

/* A sample must not inherit the slide of a box in play. */
.legend__cell .actor { transition: none; }

.keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin: 0;
  padding: 0 16px 16px;
  font-size: 13px;
}

.keys dt { font-weight: 600; }
.keys dd { margin: 0; color: var(--text-dim); }
```

- [ ] **Step 4: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ, 254 test — không đổi so với Task 4. CSS không có test; bước này chỉ để chắc chưa ai vô tình sửa file khác.

- [ ] **Step 5: Commit**

```bash
cd d:/Hung/Sokoban
git add web/styles/ui.css
git commit -m "CSS cho Settings dạng sheet, công tắc và khung tutorial"
```

---

## Kiểm tra cuối

- [ ] `cd web && npm test` — 254 test xanh, output không cảnh báo.
- [ ] `grep -rn "btn-settings-restart\|settings-tutorial\|row-restart" web/src web/index.html` — mỗi id xuất hiện ở đúng hai chỗ: markup và `settingsPanel.js`.

## Kiểm tay trên trình duyệt

**Task 5 không có test tự động, và không test nào chạm tới layout.** Chạy `cd web && python -m http.server 8000` rồi mở `http://localhost:8000`. Xếp theo mức dễ hỏng, cao xuống thấp.

1. **Chú giải ô trong Tutorial.** Đây là chỗ dễ vỡ nhất: `--cell`/`--stroke` khai báo lại bằng tay, và `.actor` là absolute. Xác nhận cả bốn ô đều vẽ ra ở 30px, thùng nằm gọn trong ô chứ không văng đi đâu, và ô "box on a goal" hiện hình tròn chứ không phải dấu X.
2. **Ẩn/hiện hàng Restart.** Mở Settings từ menu chính — không được thấy Restart. Vào chơi, mở lại — phải thấy. Bấm thì màn về đầu và panel đóng.
3. **`Esc` hai nghĩa.** Trong Tutorial bấm Esc phải lùi về list chứ không đóng panel, và tuyệt đối không thoát màn đang chơi. Bấm Esc lần nữa mới đóng.
4. **Vạch chéo khi tắt.** Tắt Sounds — phải thấy vạch chéo đè qua icon loa và cả cụm mờ đi. Kiểm trên cả Chrome và Firefox: emoji render khác nhau nên vị trí vạch có thể lệch.
5. **Tiêu đề không nhảy.** Chuyển qua lại list ↔ tutorial, chữ tiêu đề phải đứng yên tại chỗ.
6. **Sheet trên màn hẹp.** Thu cửa sổ còn 360px và xoay ngang: sheet không được tràn, khung Tutorial phải cuộn được bên trong.
7. **Âm thanh vẫn đúng.** Tắt Music, đóng, vào chơi — nhạc không được kêu, mà tiếng bước chân vẫn còn.
8. Dòng chữ mới ở menu chính đọc trôi và không tràn.
