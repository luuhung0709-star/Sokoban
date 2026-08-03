# Bỏ Redo, thêm Hint và Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gỡ Redo khỏi bản web, thêm nút Hint chạy solver Sokoban tại chỗ, và gộp hai nút mute rời rạc thành một overlay Settings có công tắc nhạc nền và hiệu ứng riêng.

**Architecture:** Solver là một module thuần (`solver.js`) tìm kiếm A* theo *nước đẩy* chứ không theo bước đi, chạy trong một Web Worker qua `hintService.js` để không đơ tab. `BoardRenderer` tô sáng thùng được gợi ý; `LevelPlayer` chặn `Command.Hint` ngoài vòng chơi. Settings là một overlay ở cấp `<body>` (mở được từ cả menu lẫn màn chơi), đọc/ghi hai cờ mới trong `ProgressStore`.

**Tech Stack:** HTML + CSS + JavaScript thuần, ES module, không build step. Test bằng `node --test`.

## Global Constraints

- **Không thêm dependency.** `web/package.json` không có `dependencies` lẫn `devDependencies`, và đó là lý do game không cần build step. Binary heap, fake DOM, mọi thứ đều viết tay.
- **Chữ trên giao diện là tiếng Anh.** Comment trong code cũng tiếng Anh, theo đúng phần còn lại của `web/`. Chỉ plan và spec này là tiếng Việt.
- **Chính tả Anh-Anh trong comment** (`colour`, `neighbour`, `normalise`, `centring`) — khớp code đang có.
- **Comment giải thích *tại sao*, không phải *cái gì*.** Đọc vài file trong `web/src/` trước khi viết để bắt đúng giọng.
- Test chạy bằng `cd web && npm test`. Chạy một file: `cd web && node --test tests/<file>.mjs`.
- Không dùng jsdom. View-layer test dùng `web/tests/fakeDom.mjs`.
- Commit sau mỗi task, message tiếng Việt, một dòng tiêu đề dưới 72 ký tự.

---

## File Structure

**Tạo mới**

| File | Trách nhiệm |
|---|---|
| `web/src/core/solver.js` | Toàn bộ thuật toán giải. Thuần, không DOM, không worker API. |
| `web/src/core/solverWorker.js` | Vỏ worker, chỉ chuyển tiếp message tới solver. |
| `web/src/core/hintService.js` | Quản lý vòng đời worker, snapshot bàn cờ, một yêu cầu tại một thời điểm. |
| `web/src/ui/settingsPanel.js` | Overlay Settings. |
| `web/tests/solver.test.mjs` | |
| `web/tests/hintService.test.mjs` | |
| `web/tests/settingsPanel.test.mjs` | |

**Sửa**

| File | Vì sao |
|---|---|
| `web/src/core/moveHistory.js` | Bỏ stack redo. |
| `web/src/core/gameSession.js` | Bỏ `tryRedo`/`canRedo`. |
| `web/src/input/inputRouter.js` | Bỏ `Command.Redo`/`KeyY`, thêm `Command.Hint`/`KeyH`. |
| `web/src/view/levelPlayer.js` | Bỏ nhánh Redo; xử lý Hint; xoá gợi ý sau mỗi lệnh. |
| `web/src/view/boardRenderer.js` | `showHint` / `clearHint`. |
| `web/src/ui/hud.js` | Bỏ nút Redo, thêm nút Hint và trạng thái của nó. |
| `web/src/ui/gameFlow.js` | Truyền `hintService`, nối hook hint. |
| `web/src/ui/mainMenu.js` | Bỏ nút mute, thêm nút Settings. |
| `web/src/progress/progressStore.js` | `muted` → `musicOn`/`sfxOn` + migrate. |
| `web/src/audio/audioService.js` | Hai công tắc thay cho một. |
| `web/src/main.js` | Dựng `HintService`, `SettingsPanel`; bỏ wiring mute. |
| `web/index.html` | Markup nút và overlay. |
| `web/styles/board.css` | Kiểu tô sáng gợi ý. |
| `web/styles/ui.css` | `.overlay--modal`, `.toolbar` xuống dòng. |
| `web/tests/fakeDom.mjs` | Thêm `remove()` — `clearHint` cần nó. |
| `web/tests/moveHistory.test.mjs`, `gameSession.test.mjs`, `hud.test.mjs`, `gameFlow.test.mjs`, `mainMenu.test.mjs`, `progressStore.test.mjs` | Theo các thay đổi trên. |

---

### Task 1: Bỏ Redo khỏi model

**Files:**
- Modify: `web/src/core/moveHistory.js`
- Modify: `web/src/core/gameSession.js`
- Test: `web/tests/moveHistory.test.mjs`, `web/tests/gameSession.test.mjs`

**Interfaces:**
- Consumes: không có.
- Produces: `MoveHistory` chỉ còn `canUndo`, `record(move)`, `popForUndo()`, `clear()`. `GameSession` chỉ còn `tryMove(dir)`, `tryUndo()`, `restart()`, và các getter `isSolved`, `canUndo`, `levelName`.

- [ ] **Step 1: Sửa test của MoveHistory cho hình dạng mới**

Thay toàn bộ `web/tests/moveHistory.test.mjs` bằng:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MoveHistory } from '../src/core/moveHistory.js';

const fakeMove = (id) => ({ id });

test('an empty history cannot undo', () => {
  const history = new MoveHistory();
  assert.equal(history.canUndo, false);
});

test('undo returns the moves back to front', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.record(fakeMove(2));

  assert.deepEqual(history.popForUndo(), fakeMove(2));
  assert.deepEqual(history.popForUndo(), fakeMove(1));
  assert.equal(history.canUndo, false);
});

test('an undone move is gone for good — there is no redo branch', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.popForUndo();

  assert.equal(history.canUndo, false);
  // `in` walks the prototype chain, so this catches a leftover getter. Object.hasOwn
  // would not: getters live on the prototype, so it reads false either way and the
  // assertion would pass against the old class too.
  assert.equal('canRedo' in history, false, 'no redo surface should remain');
});

test('clear empties the history', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.record(fakeMove(2));

  history.clear();
  assert.equal(history.canUndo, false);
});
```

- [ ] **Step 2: Chạy test, phải thấy nó đỏ**

Run: `cd web && node --test tests/moveHistory.test.mjs`
Expected: FAIL ở test `'an undone move is gone for good'` — `MoveHistory` hiện vẫn còn getter `canRedo`. Ghi lại thông báo lỗi.

- [ ] **Step 3: Rút gọn MoveHistory**

Thay toàn bộ `web/src/core/moveHistory.js` bằng:

```js
/** The stack of moves played, newest last. Undo pops; there is no redo. */
export class MoveHistory {
  #done = [];

  get canUndo() { return this.#done.length > 0; }

  record(move) {
    this.#done.push(move);
  }

  popForUndo() {
    return this.#done.pop();
  }

  clear() {
    this.#done.length = 0;
  }
}
```

- [ ] **Step 4: Chạy lại, phải xanh**

Run: `cd web && node --test tests/moveHistory.test.mjs`
Expected: PASS, 4 test.

- [ ] **Step 5: Bỏ redo khỏi test của GameSession**

Trong `web/tests/gameSession.test.mjs`, xoá hẳn hai test `'redo replays exactly the move just undone'` (dòng ~46) và `'a new move clears the redo branch'` (dòng ~56). Thêm vào cuối file:

```js
test('an undone move cannot be replayed', () => {
  const session = new GameSession(makeLevel(['#####', '#@$.#', '#####']));
  session.tryMove(Direction.Right);
  session.tryUndo();

  assert.equal(session.tryRedo, undefined, 'redo must be gone from the session, not just unused');
  assert.equal(session.moves, 0);
});
```

- [ ] **Step 6: Bỏ redo khỏi GameSession**

Trong `web/src/core/gameSession.js`: xoá getter `canRedo` (dòng 20) và toàn bộ method `tryRedo()` (dòng 59-69).

- [ ] **Step 7: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: `gameSession` và `moveHistory` xanh. `hud.test.mjs` ĐỎ vì `Hud` còn gọi `session.canRedo` — Task 2 sẽ sửa. Ghi lại đúng những file nào đỏ.

- [ ] **Step 8: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/core/moveHistory.js web/src/core/gameSession.js web/tests/moveHistory.test.mjs web/tests/gameSession.test.mjs
git commit -m "Bỏ redo khỏi MoveHistory và GameSession"
```

---

### Task 2: Bỏ Redo khỏi lớp giao diện

**Files:**
- Modify: `web/index.html:15`, `web/index.html:61`
- Modify: `web/src/input/inputRouter.js:5`, `:14`
- Modify: `web/src/view/levelPlayer.js:167`, `:191-201`
- Modify: `web/src/ui/hud.js`
- Test: `web/tests/hud.test.mjs`

**Interfaces:**
- Consumes: `GameSession` không còn `canRedo` (Task 1).
- Produces: `Command` = `{ Up, Down, Left, Right, Undo, Restart, Exit }`. `Hud` bind bốn nút: `#btn-undo`, `#btn-restart`, `#btn-exit` (nút Hint đến Task 7 mới thêm).

- [ ] **Step 1: Sửa test của Hud**

Trong `web/tests/hud.test.mjs`:

Đổi `HUD_IDS` (dòng 11-14) thành:

```js
/** The six ids Hud looks up in its constructor. Missing one throws, which is the point. */
const HUD_IDS = [
  'hud-name', 'hud-moves', 'hud-pushes',
  'btn-undo', 'btn-restart', 'btn-exit',
];
```

Đổi test `'the constructor wires all four buttons to their commands'` thành:

```js
test('the constructor wires all three buttons to their commands', () => {
  const { router } = setup();

  assert.deepEqual(router.bound, [
    { id: 'btn-undo', command: Command.Undo },
    { id: 'btn-restart', command: Command.Restart },
    { id: 'btn-exit', command: Command.Exit },
  ]);
});
```

Thay test `'undo and redo are disabled exactly when the history is empty'` bằng:

```js
test('undo is disabled exactly when the history is empty', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  assert.equal(el('btn-undo').disabled, true, 'nothing to undo yet');

  session.tryMove(Direction.Right);
  assert.equal(el('btn-undo').disabled, false);

  session.tryUndo();
  assert.equal(el('btn-undo').disabled, true);
});
```

Thay test `'solving the level greys out undo, redo and restart together'` bằng:

```js
test('solving the level greys out undo and restart together', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  // Three pushes put the only box onto the goal.
  session.tryMove(Direction.Right);
  session.tryMove(Direction.Right);
  session.tryMove(Direction.Right);
  assert.equal(session.isSolved, true, 'guard: the level really is solved');

  assert.equal(el('btn-undo').disabled, true, 'undo must not work behind the win overlay');
  assert.equal(el('btn-restart').disabled, true);
});
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/hud.test.mjs`
Expected: FAIL — `router.bound` vẫn có `btn-redo`.

- [ ] **Step 3: Bỏ redo khỏi Hud**

Trong `web/src/ui/hud.js`: xoá field `#redo` (dòng 9), dòng gán `this.#redo = ...` (dòng 17), dòng `router.bindButton(this.#redo, Command.Redo);` (dòng 21), và dòng `this.#redo.disabled = ...` (dòng 39). Sửa comment trong `refresh` từ "these three buttons" thành "these two buttons".

- [ ] **Step 4: Chạy, phải xanh**

Run: `cd web && node --test tests/hud.test.mjs`
Expected: PASS.

- [ ] **Step 5: Bỏ Redo khỏi InputRouter**

Trong `web/src/input/inputRouter.js`: xoá `Redo: 'Redo',` khỏi `Command` (dòng 5) và xoá dòng `KeyY: Command.Redo,` (dòng 14).

- [ ] **Step 6: Bỏ Redo khỏi LevelPlayer**

Trong `web/src/view/levelPlayer.js`, xoá dòng 167:

```js
    if (command === Command.Redo) return this.#stepHistory(this.#session.tryRedo(), false);
```

Đổi dòng 166 thành:

```js
    if (command === Command.Undo) return this.#stepHistory(this.#session.tryUndo());
```

Và đổi `#stepHistory` (dòng 191-201) thành — bỏ tham số `reverse`, vì undo bây giờ luôn là reverse:

```js
  async #stepHistory(move) {
    if (!move) return false;

    this.#hooks.onSound?.('undo');
    await this.#animator.play(move, { reverse: true });
    // The renderer may have been rebuilt for a different level during the wait.
    if (this.#stopped) return false;

    this.#renderer.refreshBoxLook(this.#session.board);
    return true;
  }
```

- [ ] **Step 7: Bỏ nút Redo khỏi HTML**

Trong `web/index.html`: xoá dòng 61 (`<button ... id="btn-redo" ...>`). Đổi dòng 15 thành:

```html
      <p class="panel__hint">Arrows or WASD to move · U undo · R restart level · Esc exit</p>
```

(Phần `H hint` sẽ thêm ở Task 7, khi phím đó thật sự có tác dụng.)

- [ ] **Step 8: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ.

- [ ] **Step 9: Commit**

```bash
cd d:/Hung/Sokoban
git add web/index.html web/src/input/inputRouter.js web/src/view/levelPlayer.js web/src/ui/hud.js web/tests/hud.test.mjs
git commit -m "Bỏ nút và phím Redo khỏi giao diện"
```

---

### Task 3: Solver — lưới tĩnh và bản đồ khoảng cách kéo

**Files:**
- Create: `web/src/core/solver.js`
- Test: `web/tests/solver.test.mjs`

**Interfaces:**
- Consumes: `CellType` từ `web/src/core/board.js`; `Direction`, `toDelta` từ `web/src/core/direction.js`.
- Produces:
  - `buildStatics(snapshot) → { width, height, size, wall, goal, steps }` với `wall`/`goal` là `Uint8Array` dài `size`, `steps` là mảng `{ dir, dx, dy }` bốn phần tử.
  - `buildPullDistance(statics) → number[]` dài `size`; phần tử là số nước đẩy tối thiểu để một thùng ở ô đó tới được một ô đích, `Infinity` nếu không bao giờ tới được.
  - `snapshot` là `{ width, height, statics: CellType[][], boxes: [{x,y}], player: {x,y} }`.

- [ ] **Step 1: Viết test đỏ**

Tạo `web/tests/solver.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatics, buildPullDistance } from '../src/core/solver.js';
import { makeBoard } from './helpers.mjs';

/** A Board is what the game has; a snapshot is what the solver takes. */
function snapshotOf(rows) {
  const board = makeBoard(rows);
  return {
    width: board.width,
    height: board.height,
    statics: board.statics,
    boxes: [...board.boxes].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }),
    player: { ...board.player },
  };
}

const at = (statics, values, x, y) => values[y * statics.width + x];

test('buildStatics marks walls and goals in index space', () => {
  const statics = buildStatics(snapshotOf(['#####', '#@$.#', '#####']));

  assert.equal(statics.width, 5);
  assert.equal(statics.size, 15);
  assert.equal(at(statics, statics.wall, 0, 1), 1);
  assert.equal(at(statics, statics.wall, 2, 1), 0, 'the box sits on floor, not wall');
  assert.equal(at(statics, statics.goal, 3, 1), 1);
  assert.equal(at(statics, statics.goal, 2, 1), 0);
});

test('a goal is zero pulls from itself and its neighbours count up', () => {
  const statics = buildStatics(snapshotOf(['#####', '#@$.#', '#####']));
  const dist = buildPullDistance(statics);

  assert.equal(at(statics, dist, 3, 1), 0, 'the goal itself');
  assert.equal(at(statics, dist, 2, 1), 1, 'one push away');
});

test('a square no box can ever be pushed out of is Infinity', () => {
  // The goal is at (3,2). A box in the top-left corner (1,1) has walls above and to
  // its left, so it can never be pushed anywhere useful again.
  const statics = buildStatics(snapshotOf(['#####', '#$ @#', '#  .#', '#####']));
  const dist = buildPullDistance(statics);

  assert.equal(at(statics, dist, 3, 2), 0);
  assert.equal(at(statics, dist, 2, 2), 1);
  assert.equal(at(statics, dist, 1, 1), Infinity, 'the corner is a dead square');
});

test('walls are Infinity too, so nothing ever plans a push into one', () => {
  const statics = buildStatics(snapshotOf(['#####', '#@$.#', '#####']));
  const dist = buildPullDistance(statics);

  assert.equal(at(statics, dist, 0, 0), Infinity);
});
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/solver.test.mjs`
Expected: FAIL — `Cannot find module '../src/core/solver.js'`.

- [ ] **Step 3: Viết solver.js phần lưới tĩnh**

Tạo `web/src/core/solver.js`:

```js
import { CellType } from './board.js';
import { Direction, toDelta } from './direction.js';

const DIRECTIONS = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];

/**
 * The unchanging part of a level, flattened from `statics[y][x]` to a single index
 * `y * width + x`.
 *
 * Flat typed arrays rather than the nested arrays the game uses: the search touches
 * these millions of times, and a flat index is also what lets a whole box layout be
 * compared as one sorted list of numbers.
 */
export function buildStatics(snapshot) {
  const { width, height, statics } = snapshot;
  const size = width * height;
  const wall = new Uint8Array(size);
  const goal = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = statics[y][x];
      if (cell === CellType.Wall) wall[y * width + x] = 1;
      if (cell === CellType.Goal) goal[y * width + x] = 1;
    }
  }

  const steps = DIRECTIONS.map((dir) => ({ dir, ...toDelta(dir) }));

  return { width, height, size, wall, goal, steps };
}

/**
 * The index one step away, or -1 when that leaves the grid.
 *
 * The bounds check is on x and y, NOT on the flat index: `index ± 1` would happily
 * wrap from the end of one row to the start of the next, and the search would plan
 * pushes straight through the side of the board.
 */
export function neighbourAt(statics, index, dx, dy) {
  const x = index % statics.width;
  const y = (index - x) / statics.width;
  const nx = x + dx;
  const ny = y + dy;

  if (nx < 0 || nx >= statics.width || ny < 0 || ny >= statics.height) return -1;
  return ny * statics.width + nx;
}

export function toXY(statics, index) {
  const x = index % statics.width;
  return { x, y: (index - x) / statics.width };
}

/**
 * For every square, the fewest pushes a box there needs to reach SOME goal, ignoring
 * the other boxes and ignoring whether the player can get into position. Both of those
 * only ever make the real cost higher, so this is a true lower bound — which is exactly
 * what the search wants for a heuristic.
 *
 * Computed by running the game backwards: start on the goals and PULL boxes outwards.
 * A box at `prev` can be pushed onto `at` when `prev` is floor and the square behind it
 * is floor too, because that is where the player has to stand to do the pushing.
 *
 * The squares this never reaches are dead: a box pushed there can never reach a goal
 * again, whatever anyone does. That is the single most valuable prune in the search, and
 * it falls out of the same flood fill for free.
 */
export function buildPullDistance(statics) {
  const dist = new Array(statics.size).fill(Infinity);
  const queue = [];

  for (let i = 0; i < statics.size; i++) {
    if (statics.goal[i] && !statics.wall[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];

    for (const step of statics.steps) {
      const prev = neighbourAt(statics, at, step.dx, step.dy);
      if (prev < 0 || statics.wall[prev] || dist[prev] !== Infinity) continue;

      const behind = neighbourAt(statics, prev, step.dx, step.dy);
      if (behind < 0 || statics.wall[behind]) continue;

      dist[prev] = dist[at] + 1;
      queue.push(prev);
    }
  }

  return dist;
}
```

- [ ] **Step 4: Chạy, phải xanh**

Run: `cd web && node --test tests/solver.test.mjs`
Expected: PASS, 4 test.

- [ ] **Step 5: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/core/solver.js web/tests/solver.test.mjs
git commit -m "Solver: lưới tĩnh và bản đồ khoảng cách kéo"
```

---

### Task 4: Solver — tìm kiếm A* theo nước đẩy

**Files:**
- Modify: `web/src/core/solver.js`
- Test: `web/tests/solver.test.mjs`

**Interfaces:**
- Consumes: `buildStatics`, `buildPullDistance`, `neighbourAt`, `toXY` (Task 3).
- Produces: `solveNextPush(snapshot, { maxNodes, maxMs }) → { box: { x, y }, dir } | null`. `dir` là một giá trị của `Direction`. `box` là toạ độ thùng **ở trạng thái hiện tại**, tức là ô cần tô sáng. Mặc định `maxNodes = 150_000`, `maxMs = 5_000`.

- [ ] **Step 1: Viết test đỏ**

Trước hết sửa khối import ở **đầu** `web/tests/solver.test.mjs` thành (import phải nằm trên cùng, không nhét xuống cuối file):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildStatics, buildPullDistance, solveNextPush } from '../src/core/solver.js';
import { Direction } from '../src/core/direction.js';
import { makeBoard } from './helpers.mjs';
```

Rồi thêm vào cuối file:

```js
/** Node budget is deterministic; a wall-clock budget is not, so tests never use one. */
const NO_CLOCK = { maxMs: Infinity };

test('a one-push level names the box and the direction', () => {
  const hint = solveNextPush(snapshotOf(['#####', '#@$.#', '#####']), NO_CLOCK);

  assert.deepEqual(hint, { box: { x: 2, y: 1 }, dir: Direction.Right });
});

test('the hint names the push, and says nothing about the walk to reach it', () => {
  // The player is four squares away and has to walk round to get below the box. The
  // answer is still only "push this box up" — finding the way there is the player's job.
  const hint = solveNextPush(snapshotOf([
    '#######',
    '# .   #',
    '# $   #',
    '#    @#',
    '#######',
  ]), NO_CLOCK);

  assert.deepEqual(hint, { box: { x: 2, y: 2 }, dir: Direction.Up });
});

test('an already solved board has nothing to hint', () => {
  assert.equal(solveNextPush(snapshotOf(['####', '#@*#', '####']), NO_CLOCK), null);
});

test('a box pushed into a dead corner gives up rather than guessing', () => {
  assert.equal(solveNextPush(snapshotOf(['#####', '#$ @#', '#  .#', '#####']), NO_CLOCK), null);
});

test('running out of nodes returns null instead of throwing', () => {
  const hint = solveNextPush(
    snapshotOf(['#######', '#@$  .#', '#######']),
    { maxNodes: 1, maxMs: Infinity },
  );

  assert.equal(hint, null);
});

test('boxes standing side by side do not read as frozen', () => {
  // Two boxes touching, and the solution moves one of them past the other. A prune that
  // treated "a box beside me" as a permanent block would throw this position away.
  const hint = solveNextPush(snapshotOf([
    '#######',
    '#..   #',
    '# $$@ #',
    '#     #',
    '#######',
  ]), NO_CLOCK);

  assert.notEqual(hint, null, 'this position has a solution and the solver must find it');
});

test('the solver clears the opening position of the first 20 Microban levels', () => {
  const collection = JSON.parse(
    readFileSync(fileURLToPath(new URL('../src/levels/microban.json', import.meta.url)), 'utf8'),
  );

  for (const level of collection.levels.slice(0, 20)) {
    const hint = solveNextPush(snapshotOf(level.rows), { maxNodes: 50_000, maxMs: Infinity });
    assert.notEqual(hint, null, `level ${level.name} has a solution but the solver found none`);
  }
});
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/solver.test.mjs`
Expected: FAIL — `solveNextPush is not a function`.

- [ ] **Step 3: Viết phần tìm kiếm**

Thêm vào cuối `web/src/core/solver.js`:

```js
const DEFAULT_MAX_NODES = 150_000;
const DEFAULT_MAX_MS = 5_000;

/**
 * How hard the search leans on the heuristic. At 1 it returns the shortest solution and
 * takes far longer; at 2 it finds a good-enough plan several times faster. A hint only
 * has to name a push that leads somewhere, so the trade is worth taking.
 */
const WEIGHT = 2;

/** Reading the clock on every pop costs more than it saves, so check it in batches. */
const CLOCK_EVERY = 512;

/** A binary min-heap on `f`. Hand-rolled — the project takes no dependencies. */
class Heap {
  #items = [];

  get size() { return this.#items.length; }

  push(node) {
    const items = this.#items;
    items.push(node);

    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this.#items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0) return top;

    items[0] = last;
    let i = 0;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < items.length && items[left].f < items[smallest].f) smallest = left;
      if (right < items.length && items[right].f < items[smallest].f) smallest = right;
      if (smallest === i) break;
      [items[smallest], items[i]] = [items[i], items[smallest]];
      i = smallest;
    }

    return top;
  }
}

/** Every square the player can walk to, given where the boxes are. */
function reachable(statics, boxAt, from) {
  const seen = new Uint8Array(statics.size);
  seen[from] = 1;
  const queue = [from];

  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    for (const step of statics.steps) {
      const next = neighbourAt(statics, at, step.dx, step.dy);
      if (next < 0 || seen[next] || statics.wall[next] || boxAt[next]) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }

  return seen;
}

/**
 * True when the box just pushed onto `at` is stuck there for good and `at` is not a goal.
 *
 * The test is a full 2×2 block of wall-or-box. That is sound: inside a sealed 2×2 every
 * box has a blocked square on both axes drawn from the block itself, so it can be pushed
 * along neither — and the squares blocking it are walls, or boxes locked exactly the same
 * way. The block is fixed forever.
 *
 * Do NOT weaken this to "blocked on one horizontal and one vertical neighbour". A box
 * blocking from the side may itself be pushable away, so that rule prunes positions that
 * are still solvable, and the hint would go wrong rather than merely slow.
 *
 * It also does not have to catch every deadlock. Missing one only costs search time;
 * inventing one would cost correctness.
 */
function isFrozen(statics, boxAt, at) {
  const blocked = (i) => i < 0 || statics.wall[i] === 1 || boxAt[i] === 1;

  for (const [ox, oy] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
    const corner = neighbourAt(statics, at, ox, oy);
    if (corner < 0) continue;

    const cells = [
      corner,
      neighbourAt(statics, corner, 1, 0),
      neighbourAt(statics, corner, 0, 1),
      neighbourAt(statics, corner, 1, 1),
    ];
    if (!cells.every(blocked)) continue;

    // A sealed block is fine as long as every box caught in it already sits on a goal.
    if (cells.some((i) => i >= 0 && boxAt[i] === 1 && !statics.goal[i])) return true;
  }

  return false;
}

/**
 * The next push on some path to a solved board, or null.
 *
 * Searches over PUSHES, not steps. Walking the player between two pushes is free — the
 * flood fill below decides in one pass whether a push is reachable at all — so a push is
 * one edge of the graph. That makes the state space tens of times smaller than searching
 * step by step.
 *
 * Returns null when the board is already solved, when this position has no solution left
 * (the player has pushed a box somewhere fatal), or when the budget runs out. The caller
 * cannot tell those apart, and does not need to: all three mean "no hint".
 */
export function solveNextPush(snapshot, { maxNodes = DEFAULT_MAX_NODES, maxMs = DEFAULT_MAX_MS } = {}) {
  const statics = buildStatics(snapshot);
  const pullDistance = buildPullDistance(statics);

  const startBoxes = snapshot.boxes
    .map(({ x, y }) => y * statics.width + x)
    .sort((a, b) => a - b);
  const startPlayer = snapshot.player.y * statics.width + snapshot.player.x;

  if (startBoxes.every((i) => statics.goal[i] === 1)) return null;
  if (startBoxes.some((i) => pullDistance[i] === Infinity)) return null;

  const heuristic = (boxes) => boxes.reduce((sum, i) => sum + pullDistance[i], 0);

  const open = new Heap();
  const queued = new Set();
  const closed = new Set();
  const deadline = maxMs === Infinity ? Infinity : Date.now() + maxMs;

  open.push({
    boxes: startBoxes,
    player: startPlayer,
    g: 0,
    f: WEIGHT * heuristic(startBoxes),
    firstPush: null,
  });
  queued.add(`${startBoxes.join(',')}|${startPlayer}`);

  let expanded = 0;

  while (open.size > 0) {
    if (++expanded > maxNodes) return null;
    if (expanded % CLOCK_EVERY === 0 && Date.now() > deadline) return null;

    const node = open.pop();

    const boxAt = new Uint8Array(statics.size);
    for (const i of node.boxes) boxAt[i] = 1;

    const seen = reachable(statics, boxAt, node.player);

    // Where the player stands inside its region does not matter, only which region it
    // is, so states are keyed on the region's lowest square. Normalising here rather
    // than when the node was queued means one flood fill per pop instead of one per
    // successor — the same dedup for a fraction of the work.
    const key = `${node.boxes.join(',')}|${seen.indexOf(1)}`;
    if (closed.has(key)) continue;
    closed.add(key);

    for (const box of node.boxes) {
      for (const step of statics.steps) {
        const stand = neighbourAt(statics, box, -step.dx, -step.dy);
        if (stand < 0 || !seen[stand]) continue;

        const dest = neighbourAt(statics, box, step.dx, step.dy);
        if (dest < 0 || statics.wall[dest] || boxAt[dest]) continue;
        if (pullDistance[dest] === Infinity) continue;

        boxAt[box] = 0;
        boxAt[dest] = 1;
        const frozen = isFrozen(statics, boxAt, dest);
        boxAt[box] = 1;
        boxAt[dest] = 0;
        if (frozen) continue;

        const boxes = node.boxes.map((i) => (i === box ? dest : i)).sort((a, b) => a - b);

        // The player ends up where the box was standing.
        const nextKey = `${boxes.join(',')}|${box}`;
        if (queued.has(nextKey)) continue;
        queued.add(nextKey);

        // Carry the opening push along the path instead of keeping parent pointers:
        // it is the only thing the caller ever asks for.
        const firstPush = node.firstPush ?? { box: toXY(statics, box), dir: step.dir };
        if (boxes.every((i) => statics.goal[i] === 1)) return firstPush;

        open.push({
          boxes,
          player: box,
          g: node.g + 1,
          f: node.g + 1 + WEIGHT * heuristic(boxes),
          firstPush,
        });
      }
    }
  }

  return null;
}
```

- [ ] **Step 4: Chạy, phải xanh**

Run: `cd web && node --test tests/solver.test.mjs`
Expected: PASS, 11 test. Test Microban 20 màn có thể mất vài giây — chấp nhận được.

Nếu test `'the box named is the one to push next'` đỏ vì hướng khác dự đoán, KHÔNG sửa assert cho khớp. Kiểm tra lại `neighbourAt` với `-step.dx, -step.dy`: `stand` phải là ô người chơi đứng, tức là phía **đối diện** hướng đẩy.

- [ ] **Step 5: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/core/solver.js web/tests/solver.test.mjs
git commit -m "Solver: tìm kiếm A* theo nước đẩy, cắt tỉa ô chết và khối 2x2"
```

---

### Task 5: HintService và worker

**Files:**
- Create: `web/src/core/solverWorker.js`
- Create: `web/src/core/hintService.js`
- Test: `web/tests/hintService.test.mjs`

**Interfaces:**
- Consumes: `solveNextPush` (Task 4); `Board` (chỉ đọc `width`, `height`, `statics`, `boxes`, `player`).
- Produces: `new HintService({ createWorker })`, `requestHint(board) → Promise<{ box, dir } | null>`, `dispose()`. `createWorker` mặc định dựng module worker từ `solverWorker.js`; test tiêm hàm khác.

- [ ] **Step 1: Viết test đỏ**

Tạo `web/tests/hintService.test.mjs`:

```js
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

test('dispose shuts the worker down', () => {
  const worker = makeFakeWorker();
  const service = new HintService({ createWorker: () => worker });
  service.requestHint(board());

  service.dispose();

  assert.equal(worker.terminated, 1);
});
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/hintService.test.mjs`
Expected: FAIL — `Cannot find module '../src/core/hintService.js'`.

- [ ] **Step 3: Viết worker**

Tạo `web/src/core/solverWorker.js`:

```js
import { solveNextPush } from './solver.js';

/**
 * The solver runs here rather than on the page so a five-second search cannot freeze the
 * tab. This file stays a pure relay — everything worth testing lives in solver.js, which
 * needs no worker to run.
 */
self.onmessage = ({ data: { id, snapshot, budget } }) => {
  try {
    self.postMessage({ id, hint: solveNextPush(snapshot, budget) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
```

- [ ] **Step 4: Viết HintService**

Tạo `web/src/core/hintService.js`:

```js
import { solveNextPush } from './solver.js';

/**
 * The budget used when the search has to run on the page itself. Much smaller than the
 * worker's, because every millisecond of it is a millisecond the tab is frozen.
 */
const MAIN_THREAD_BUDGET = { maxNodes: 20_000, maxMs: 1_500 };

const defaultCreateWorker = () =>
  new Worker(new URL('./solverWorker.js', import.meta.url), { type: 'module' });

/**
 * Asks the solver for the next push, off the main thread.
 *
 * `createWorker` is injected so tests can hand in a fake — there is no Worker in
 * `node --test`, and the real one would need a build step to be reachable from there.
 */
export class HintService {
  #createWorker;
  #worker = null;
  #brokenWorker = false;
  #nextId = 1;
  #pending = null;      // { id, resolve }

  constructor({ createWorker = defaultCreateWorker } = {}) {
    this.#createWorker = createWorker;
  }

  /** Resolves with the push to make, or null — never rejects. The caller has no repair to do. */
  requestHint(board) {
    // Only one search at a time. Whoever asked first is no longer looking at the board
    // they asked about, so answer them null rather than leaving the promise hanging.
    this.#settle(null);

    const snapshot = snapshotOf(board);
    const worker = this.#ensureWorker();

    if (!worker) return Promise.resolve(solveNextPush(snapshot, MAIN_THREAD_BUDGET));

    const id = this.#nextId++;
    return new Promise((resolve) => {
      this.#pending = { id, resolve };
      worker.postMessage({ id, snapshot });
    });
  }

  dispose() {
    this.#settle(null);
    this.#worker?.terminate();
    this.#worker = null;
  }

  /**
   * Returns null when this browser cannot give us a worker — Firefox had no module
   * workers before 114, and a sandboxed page may refuse outright. The hint still works
   * from the main thread; it just thinks for less time. Same choice BoardRenderer makes
   * for missing sprites and ProgressStore for a blocked localStorage: degrade, never die.
   */
  #ensureWorker() {
    if (this.#worker || this.#brokenWorker) return this.#worker;

    try {
      this.#worker = this.#createWorker();
      this.#worker.onmessage = ({ data }) => this.#onMessage(data);
    } catch (error) {
      console.warn(`HintService: no worker available, solving on the page (${error.message})`);
      this.#brokenWorker = true;
      this.#worker = null;
    }

    return this.#worker;
  }

  #onMessage({ id, hint, error }) {
    // A reply to a request that has already been superseded. Dropping it matters: it
    // describes a board the player has since changed.
    if (this.#pending?.id !== id) return;

    if (error) console.error(`HintService: the solver failed (${error})`);
    this.#settle(error ? null : hint ?? null);
  }

  #settle(value) {
    const pending = this.#pending;
    this.#pending = null;
    pending?.resolve(value);
  }
}

/**
 * A Board flattened to data `structuredClone` can carry: its methods would be lost
 * crossing into the worker, and `boxes` is a Set of "x,y" strings that the solver would
 * rather have as coordinates anyway.
 */
function snapshotOf(board) {
  return {
    width: board.width,
    height: board.height,
    statics: board.statics.map((row) => [...row]),
    boxes: [...board.boxes].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }),
    player: { ...board.player },
  };
}
```

- [ ] **Step 5: Chạy, phải xanh**

Run: `cd web && node --test tests/hintService.test.mjs`
Expected: PASS, 7 test.

- [ ] **Step 6: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/core/hintService.js web/src/core/solverWorker.js web/tests/hintService.test.mjs
git commit -m "HintService: chạy solver trong worker, có đường lui về main thread"
```

---

### Task 6: Tô sáng gợi ý trên bàn cờ

**Files:**
- Modify: `web/src/view/boardRenderer.js`
- Modify: `web/styles/board.css`
- Modify: `web/tests/fakeDom.mjs`
- Test: `web/tests/hint.render.test.mjs` (tạo mới)

**Interfaces:**
- Consumes: `Direction`.
- Produces: `BoardRenderer.showHint({ x, y }, dir)` và `BoardRenderer.clearHint()`. Thùng được gợi ý mang class `actor--hint` và chứa một phần tử con class `actor__hint-arrow`.

- [ ] **Step 1: Thêm `remove()` vào fake DOM**

Trong `web/tests/fakeDom.mjs`, thêm vào object trả về từ `makeElement`, ngay sau `append`:

```js
    remove() {
      const parent = this.parentElement;
      if (!parent) return;
      parent.children = parent.children.filter((kid) => kid !== this);
      this.parentElement = null;
    },
```

- [ ] **Step 2: Viết test đỏ**

Tạo `web/tests/hint.render.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { BoardRenderer } from '../src/view/boardRenderer.js';
import { Direction } from '../src/core/direction.js';
import { makeBoard } from './helpers.mjs';
import { installDocument, makeElement } from './fakeDom.mjs';

installDocument();

/** A board with the player at (1,1) and a box at (2,1). */
function setup() {
  const root = makeElement('div');
  const renderer = new BoardRenderer(root);
  const board = makeBoard(['#####', '#@$.#', '#####']);
  renderer.build(board);
  return { renderer, board };
}

test('showHint marks the named box and hangs an arrow on it', () => {
  const { renderer } = setup();

  renderer.showHint({ x: 2, y: 1 }, Direction.Right);

  const box = renderer.boxElAt(2, 1);
  assert.equal(box.classList.contains('actor--hint'), true);
  assert.notEqual(box.querySelector('.actor__hint-arrow'), null);
});

test('the arrow carries the rotation for its direction', () => {
  const { renderer } = setup();

  renderer.showHint({ x: 2, y: 1 }, Direction.Left);

  const arrow = renderer.boxElAt(2, 1).querySelector('.actor__hint-arrow');
  assert.equal(arrow.style['--hint-rot'], '270deg');
});

test('clearHint takes the mark and the arrow back off', () => {
  const { renderer } = setup();
  renderer.showHint({ x: 2, y: 1 }, Direction.Right);

  renderer.clearHint();

  const box = renderer.boxElAt(2, 1);
  assert.equal(box.classList.contains('actor--hint'), false);
  assert.equal(box.querySelector('.actor__hint-arrow'), null, 'a stale arrow would stack up');
});

test('a second hint replaces the first rather than adding to it', () => {
  const { renderer } = setup();

  renderer.showHint({ x: 2, y: 1 }, Direction.Right);
  renderer.showHint({ x: 2, y: 1 }, Direction.Up);

  const box = renderer.boxElAt(2, 1);
  assert.equal(box.querySelectorAll('.actor__hint-arrow').length, 1);
});

test('clearHint on a board with no hint showing is harmless', () => {
  const { renderer } = setup();

  assert.doesNotThrow(() => renderer.clearHint());
});

test('a hint aimed at a square with no box is ignored, not crashed on', () => {
  const { renderer } = setup();

  assert.doesNotThrow(() => renderer.showHint({ x: 3, y: 1 }, Direction.Right));
});

test('rebuilding for a new level forgets the old hint', () => {
  const { renderer } = setup();
  renderer.showHint({ x: 2, y: 1 }, Direction.Right);

  renderer.build(makeBoard(['#####', '#@$.#', '#####']));

  // The old element is gone; clearHint must not reach back into it.
  assert.doesNotThrow(() => renderer.clearHint());
  assert.equal(renderer.boxElAt(2, 1).classList.contains('actor--hint'), false);
});
```

- [ ] **Step 3: Chạy, phải đỏ**

Run: `cd web && node --test tests/hint.render.test.mjs`
Expected: FAIL — `renderer.showHint is not a function`.

- [ ] **Step 4: Thêm showHint/clearHint vào BoardRenderer**

Trong `web/src/view/boardRenderer.js`:

Thêm hằng số ngay dưới `const CELL_MAX = 64;`:

```js
/**
 * The hint arrow is drawn pointing up, so each direction is just a quarter turn from
 * there. Keeping the art at one angle means one clip-path instead of four.
 */
const HINT_ROTATION = {
  [Direction.Up]: 0,
  [Direction.Right]: 90,
  [Direction.Down]: 180,
  [Direction.Left]: 270,
};
```

Thêm field cạnh `#missingPush`:

```js
  #hintEl = null;
```

Trong `build(board)`, thêm ngay sau `this.#boxes.clear();`:

```js
    // The whole tree is about to be replaced, so the old hint element is already gone.
    // Drop the reference too, or clearHint would poke at a detached node.
    this.#hintEl = null;
```

Thêm hai method public, đặt ngay sau `refreshBoxLook`:

```js
  /**
   * Marks the box the solver says to push next, and which way. Only the box is shown,
   * not the walk to it: working out how to get behind the box is the easy half of
   * Sokoban, and doing it for the player would give the whole level away.
   */
  showHint({ x, y }, dir) {
    this.clearHint();

    const el = this.boxElAt(x, y);
    // The hint may arrive after the board moved on. Nothing to point at is not a fault.
    if (!el) return;

    const arrow = document.createElement('i');
    arrow.className = 'actor__hint-arrow';
    arrow.style.setProperty('--hint-rot', `${HINT_ROTATION[dir] ?? 0}deg`);

    el.classList.add('actor--hint');
    el.append(arrow);
    this.#hintEl = el;
  }

  clearHint() {
    if (!this.#hintEl) return;

    this.#hintEl.classList.remove('actor--hint');
    this.#hintEl.querySelector('.actor__hint-arrow')?.remove();
    this.#hintEl = null;
  }
```

- [ ] **Step 5: Chạy, phải xanh**

Run: `cd web && node --test tests/hint.render.test.mjs`
Expected: PASS, 7 test.

- [ ] **Step 6: Thêm CSS**

Thêm vào cuối `web/styles/board.css`:

```css
/*
 * The hint: a pulsing ring on the box to push next, plus an arrow for the direction.
 *
 * The ring is animated through box-shadow rather than opacity — fading the face would
 * dim the box itself, and the box has to stay readable while the hint is up.
 *
 * Fixed px rather than tied to --cell like the strokes above: this is an overlay calling
 * for attention, not part of the board's material, and 2–5px reads at every cell size.
 */
.actor--hint .actor__face {
  animation: hint-pulse 900ms ease-in-out infinite;
}

@keyframes hint-pulse {
  0%, 100% { box-shadow: 0 0 0 2px var(--accent); }
  50%      { box-shadow: 0 0 0 5px var(--accent); }
}

/*
 * The push direction. Drawn pointing up and turned by --hint-rot, so all four
 * directions come from one shape. `.actor` is already absolutely positioned, so `inset`
 * here resolves against the box.
 */
.actor__hint-arrow {
  position: absolute;
  inset: 0;
  margin: auto;
  width: calc(var(--cell) * 0.42);
  height: calc(var(--cell) * 0.42);
  background: var(--accent);
  clip-path: polygon(50% 0%, 100% 100%, 50% 72%, 0% 100%);
  transform: rotate(var(--hint-rot, 0deg));
  pointer-events: none;
}
```

- [ ] **Step 7: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/view/boardRenderer.js web/styles/board.css web/tests/fakeDom.mjs web/tests/hint.render.test.mjs
git commit -m "BoardRenderer: tô sáng thùng gợi ý kèm mũi tên hướng đẩy"
```

---

### Task 7: Nối nút Hint vào game

**Files:**
- Modify: `web/index.html:15`, `:59-63`
- Modify: `web/src/input/inputRouter.js`
- Modify: `web/src/ui/hud.js`
- Modify: `web/src/view/levelPlayer.js`
- Modify: `web/src/ui/gameFlow.js`
- Modify: `web/src/main.js`
- Test: `web/tests/hud.test.mjs`, `web/tests/gameFlow.test.mjs`

**Interfaces:**
- Consumes: `HintService.requestHint` (Task 5); `BoardRenderer.showHint`/`clearHint` (Task 6).
- Produces: `Command.Hint`; `Hud.setHintBusy(on)` và `Hud.flashNoHint()`; `LevelPlayer` nhận thêm `hintService` trong object constructor và gọi hook `onHintStart()` / `onHintDone(found)`; `GameFlow` nhận thêm `hintService`.

- [ ] **Step 1: Thêm Command.Hint**

Trong `web/src/input/inputRouter.js`, đổi `Command` và `KEY_TO_COMMAND`:

```js
export const Command = Object.freeze({
  Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right',
  Undo: 'Undo', Hint: 'Hint', Restart: 'Restart', Exit: 'Exit',
});

const KEY_TO_COMMAND = {
  ArrowUp: Command.Up, KeyW: Command.Up,
  ArrowDown: Command.Down, KeyS: Command.Down,
  ArrowLeft: Command.Left, KeyA: Command.Left,
  ArrowRight: Command.Right, KeyD: Command.Right,
  KeyU: Command.Undo,
  KeyH: Command.Hint,
  KeyR: Command.Restart,
  Escape: Command.Exit,
};
```

- [ ] **Step 2: Thêm nút Hint vào HTML**

Trong `web/index.html`, đổi `<footer class="toolbar">` thành:

```html
    <footer class="toolbar">
      <button class="btn" id="btn-undo" type="button">↶ Undo</button>
      <button class="btn" id="btn-hint" type="button">💡 Hint</button>
      <button class="btn" id="btn-restart" type="button">⟳ Restart</button>
      <button class="btn" id="btn-exit" type="button">← Select level</button>
    </footer>
```

Và đổi dòng 15 thành:

```html
      <p class="panel__hint">Arrows or WASD to move · U undo · H hint · R restart level · Esc exit</p>
```

- [ ] **Step 3: Viết test đỏ cho Hud**

Trong `web/tests/hud.test.mjs`, đưa `'btn-hint'` vào `HUD_IDS` và sửa test bind:

```js
/** The seven ids Hud looks up in its constructor. Missing one throws, which is the point. */
const HUD_IDS = [
  'hud-name', 'hud-moves', 'hud-pushes',
  'btn-undo', 'btn-hint', 'btn-restart', 'btn-exit',
];
```

```js
test('the constructor wires all four buttons to their commands', () => {
  const { router } = setup();

  assert.deepEqual(router.bound, [
    { id: 'btn-undo', command: Command.Undo },
    { id: 'btn-hint', command: Command.Hint },
    { id: 'btn-restart', command: Command.Restart },
    { id: 'btn-exit', command: Command.Exit },
  ]);
});
```

Thêm vào cuối file:

```js
test('the hint button is live while the level is unsolved', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  assert.equal(el('btn-hint').disabled, false);
  assert.equal(el('btn-hint').textContent, '💡 Hint');
});

test('solving the level greys the hint button out with the rest', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  session.tryMove(Direction.Right);
  session.tryMove(Direction.Right);
  session.tryMove(Direction.Right);

  assert.equal(el('btn-hint').disabled, true, 'there is nothing left to hint at');
});

test('while the solver runs the button says so and cannot be pressed again', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  hud.setHintBusy(true);
  assert.equal(el('btn-hint').textContent, '💡 Thinking…');
  assert.equal(el('btn-hint').disabled, true);

  hud.setHintBusy(false);
  assert.equal(el('btn-hint').textContent, '💡 Hint');
  assert.equal(el('btn-hint').disabled, false);
});

test('a search that found nothing says so on the button itself', () => {
  const { hud, session, el } = setup();
  hud.bind(session);

  hud.flashNoHint();
  assert.equal(el('btn-hint').textContent, '💡 No hint');

  // Also cancels the pending timer, so node --test does not sit waiting for it.
  hud.setHintBusy(true);
  assert.equal(el('btn-hint').textContent, '💡 Thinking…',
    'a new search must win over the message left from the last one');
});

test('an unbound hud keeps the hint button disabled', () => {
  const { hud, session, el } = setup();
  const unbind = hud.bind(session);

  unbind();
  hud.setHintBusy(false);

  assert.equal(el('btn-hint').disabled, true, 'no session means nothing to solve');
});
```

- [ ] **Step 4: Chạy, phải đỏ**

Run: `cd web && node --test tests/hud.test.mjs`
Expected: FAIL — `hud.setHintBusy is not a function`.

- [ ] **Step 5: Viết lại Hud**

Thay toàn bộ `web/src/ui/hud.js` bằng:

```js
import { Command } from '../input/inputRouter.js';

/** How long the button admits it found nothing before going back to inviting a press. */
const NO_HINT_MS = 2000;

/** The info bar on top and the button row below. Follows the session via onChange. */
export class Hud {
  #name;
  #moves;
  #pushes;
  #undo;
  #hint;
  #restartBtn;

  #session = null;
  #hintBusy = false;
  #noHintTimer = null;

  constructor(rootEl, router) {
    this.#name = rootEl.querySelector('#hud-name');
    this.#moves = rootEl.querySelector('#hud-moves');
    this.#pushes = rootEl.querySelector('#hud-pushes');
    this.#undo = rootEl.querySelector('#btn-undo');
    this.#hint = rootEl.querySelector('#btn-hint');
    this.#restartBtn = rootEl.querySelector('#btn-restart');

    router.bindButton(this.#undo, Command.Undo);
    router.bindButton(this.#hint, Command.Hint);
    router.bindButton(this.#restartBtn, Command.Restart);
    router.bindButton(rootEl.querySelector('#btn-exit'), Command.Exit);
  }

  setLevelLabel(text) {
    this.#name.textContent = text;
  }

  /** Returns an unbind function, so changing level leaves no listener on the old session. */
  bind(session) {
    this.#session = session;
    this.#hintBusy = false;
    this.#clearNoHint();

    const refresh = () => {
      // Once solved these buttons do nothing — grey them out, or they look clickable
      // while clicking them achieves nothing.
      const solved = session.isSolved;
      this.#moves.textContent = String(session.moves);
      this.#pushes.textContent = String(session.pushes);
      this.#undo.disabled = solved || !session.canUndo;
      this.#restartBtn.disabled = solved;
      this.#refreshHint();
    };

    refresh();
    const off = session.onChange(refresh);

    return () => {
      off();
      // Only drop the session if it is still ours: unbinding after the next level has
      // already bound would otherwise blank out the live one.
      if (this.#session === session) {
        this.#session = null;
        this.#refreshHint();
      }
    };
  }

  /** A search is in flight: say so, and refuse a second press until it lands. */
  setHintBusy(on) {
    this.#hintBusy = Boolean(on);
    if (this.#hintBusy) this.#clearNoHint();
    this.#refreshHint();
  }

  /** The solver came back empty. The button is where the player is looking, so say it there. */
  flashNoHint() {
    this.#clearNoHint();
    this.#hint.textContent = '💡 No hint';
    this.#noHintTimer = setTimeout(() => {
      this.#noHintTimer = null;
      this.#refreshHint();
    }, NO_HINT_MS);
  }

  /**
   * Cancels a running message. Without this, pressing twice in a row lets the first
   * timer fire late and wipe the label the second press just put up.
   */
  #clearNoHint() {
    if (this.#noHintTimer === null) return;
    clearTimeout(this.#noHintTimer);
    this.#noHintTimer = null;
  }

  #refreshHint() {
    this.#hint.disabled = this.#hintBusy || !this.#session || this.#session.isSolved;

    if (this.#hintBusy) this.#hint.textContent = '💡 Thinking…';
    else if (this.#noHintTimer === null) this.#hint.textContent = '💡 Hint';
  }
}
```

- [ ] **Step 6: Chạy, phải xanh**

Run: `cd web && node --test tests/hud.test.mjs`
Expected: PASS.

- [ ] **Step 7: Xử lý Hint trong LevelPlayer**

Trong `web/src/view/levelPlayer.js`:

Thêm hai field cạnh `#wake`:

```js
  #hintService;
  #hintBusy = false;
```

Đổi constructor:

```js
  constructor({ session, renderer, animator, router, hintService = null, hooks = {} }) {
    this.#session = session;
    this.#renderer = renderer;
    this.#animator = animator;
    this.#router = router;
    this.#hintService = hintService;
    this.#hooks = hooks;
  }
```

Thêm `this.#renderer.clearHint();` làm dòng đầu tiên của `start()`, và cũng vào `stop()` ngay sau `this.#buffered = null;`.

Trong `handle(command)`, thêm ngay sau khối `Command.Exit`:

```js
    // Hint is answered here, OUTSIDE the play loop and before the busy check. Letting it
    // into the loop would queue it behind a move, so the highlight would appear one step
    // too late — and it has no animation to sequence with in the first place.
    if (command === Command.Hint) {
      void this.#showHint();
      return;
    }
```

Thêm method mới, đặt ngay sau `handle`:

```js
  /**
   * Asks the solver about the position on screen right now.
   *
   * The answer can take seconds, so everything is re-checked when it lands: the player
   * may have moved on, or left the level entirely, and a hint drawn onto a board that has
   * changed points at the wrong square.
   */
  async #showHint() {
    if (!this.#hintService || this.#hintBusy || this.#session.isSolved) return;

    const askedAt = this.#session.moves;
    this.#hintBusy = true;
    this.#hooks.onHintStart?.();

    let hint = null;
    try {
      hint = await this.#hintService.requestHint(this.#session.board);
    } catch (error) {
      // requestHint is built never to reject, but this call is fired with `void`, so a
      // broken promise would surface as an unhandled rejection with nothing to trace it
      // back to. Swallow it here and the button still comes out of its thinking state.
      console.error('LevelPlayer: asking for a hint failed', error);
    } finally {
      this.#hintBusy = false;
    }

    const stale = this.#stopped || this.#session.moves !== askedAt;
    // `found` is forced true when stale: the button must come out of its thinking state
    // either way, but a board nobody is looking at any more has no bad news to report.
    this.#hooks.onHintDone?.(stale || Boolean(hint));
    if (stale || !hint) return;

    this.#renderer.showHint(hint.box, hint.dir);
  }
```

Trong `#runOne`, thêm ngay trước `const acted = ...`:

```js
    // Any command at all invalidates the hint on screen — including a blocked move,
    // where the player has at least turned and the arrow no longer reads right.
    this.#renderer.clearHint();
```

- [ ] **Step 8: Nối GameFlow**

Trong `web/src/ui/gameFlow.js`:

Thêm field `#hintService;` cạnh `#audio;`, và nhận nó trong constructor:

```js
  constructor({ collection, progress, router, renderer, animator, hud, panels, audio, hintService }) {
    this.#collection = collection;
    this.#progress = progress;
    this.#router = router;
    this.#renderer = renderer;
    this.#animator = animator;
    this.#hud = hud;
    this.#panels = panels;
    this.#audio = audio;
    this.#hintService = hintService;
  }
```

Trong `playLevel`, đổi phần dựng `LevelPlayer`:

```js
    this.#player = new LevelPlayer({
      session: this.#session,
      renderer: this.#renderer,
      animator: this.#animator,
      router: this.#router,
      hintService: this.#hintService,
      hooks: {
        onExit: () => this.showLevelSelect(),
        onSolved: () => this.#onSolved(),
        onSound: (name) => this.#audio.play(name),
        onHintStart: () => this.#hud.setHintBusy(true),
        onHintDone: (found) => {
          this.#hud.setHintBusy(false);
          if (!found) this.#hud.flashNoHint();
        },
      },
    });
```

- [ ] **Step 9: Vá renderer giả trong gameFlow.test.mjs**

Trong `web/tests/gameFlow.test.mjs`, thêm vào object `renderer` (dòng ~47):

```js
    showHint() {},
    clearHint() {},
```

và thêm vào `setup()`, ngay trước `const flow = new GameFlow(...)`:

```js
  const hintService = {
    asked: 0,
    hint: null,
    requestHint() { this.asked++; return Promise.resolve(this.hint); },
  };
```

Truyền `hintService` vào `new GameFlow({ ... })` và trả nó ra từ `setup()`.

Thêm hai test vào cuối file:

```js
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
```

Và mở rộng `hud` giả:

```js
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
```

- [ ] **Step 10: Dựng HintService trong main.js**

Trong `web/src/main.js`:

Thêm vào khối import:

```js
import { HintService } from './core/hintService.js';
```

Thêm ngay sau `const audio = new AudioService(progress);`:

```js
// One worker for the whole session — spinning a new one up per level would pay the
// startup cost 155 times over.
const hintService = new HintService();
```

Và truyền vào `GameFlow`:

```js
const flow = new GameFlow({
  collection, progress, router, renderer, animator, hud, panels, audio, hintService,
});
```

- [ ] **Step 11: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ.

- [ ] **Step 12: Thử tay trong trình duyệt**

Run: `cd web && python -m http.server 8000` (hoặc `npx serve`), mở `http://localhost:8000`.

Kiểm: bấm Hint ở màn 1 → một thùng có viền đỏ nhấp nháy và mũi tên chỉ đúng hướng đẩy. Đi một bước → gợi ý biến mất. Nhấn `H` cũng cho kết quả như bấm nút. Không còn nút Redo, phím `Y` không làm gì.

- [ ] **Step 13: Commit**

```bash
cd d:/Hung/Sokoban
git add web/index.html web/src/input/inputRouter.js web/src/ui/hud.js web/src/view/levelPlayer.js web/src/ui/gameFlow.js web/src/main.js web/tests/hud.test.mjs web/tests/gameFlow.test.mjs
git commit -m "Nối nút Hint: phím H, trạng thái nút và vòng đời gợi ý"
```

---

### Task 8: ProgressStore — tách nhạc nền và hiệu ứng

**Files:**
- Modify: `web/src/progress/progressStore.js`
- Test: `web/tests/progressStore.test.mjs`

**Interfaces:**
- Consumes: không có.
- Produces: `ProgressStore` có `get/set musicOn` và `get/set sfxOn` (boolean, mặc định `true`). Getter/setter `muted` biến mất. Hình dạng lưu: `{ musicOn, sfxOn, collections: [...] }`.

- [ ] **Step 1: Sửa test**

Trong `web/tests/progressStore.test.mjs`:

Thay test `'the mute setting is stored alongside progress'` bằng:

```js
test('the two sound settings are stored alongside progress', () => {
  const storage = fakeStorage();
  const store = new ProgressStore(storage);
  store.musicOn = false;

  const reloaded = new ProgressStore(storage);
  assert.equal(reloaded.musicOn, false);
  assert.equal(reloaded.sfxOn, true, 'the two switches are independent');
});

test('sound is on by default', () => {
  const store = new ProgressStore(fakeStorage());
  assert.equal(store.musicOn, true);
  assert.equal(store.sfxOn, true);
});
```

Trong test `'corrupt JSON resets to empty instead of throwing'`, đổi `assert.equal(store.muted, false);` thành:

```js
  assert.equal(store.musicOn, true);
  assert.equal(store.sfxOn, true);
```

Thay test `'JSON that parses but lacks fields is still usable'` bằng:

```js
test('JSON that parses but lacks fields is still usable', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{}' }));
  assert.equal(store.musicOn, true);
  assert.equal(store.getRecord('Microban', 0).completed, false);
});

test('a save from the days of a single mute switch turns both switches off', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{"muted":true}' }));

  assert.equal(store.musicOn, false);
  assert.equal(store.sfxOn, false, 'the old switch silenced everything, so both must follow');
});

test('an old save with sound left on comes through with both switches on', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{"muted":false}' }));

  assert.equal(store.musicOn, true);
  assert.equal(store.sfxOn, true);
});
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/progressStore.test.mjs`
Expected: FAIL — `store.musicOn` là `undefined`.

- [ ] **Step 3: Sửa ProgressStore**

Trong `web/src/progress/progressStore.js`:

Đổi comment đầu file (dòng 3-9) thành:

```js
/**
 * Progress is stored as JSON in localStorage.
 *
 * storage is injected so tests can plug in a fake localStorage — this module is the
 * only place in the game that touches localStorage.
 */
```

Trong getter `#data`, đổi giá trị khởi tạo và phần đọc:

```js
  get #data() {
    if (this.#root) return this.#root;

    this.#root = { musicOn: true, sfxOn: true, collections: [] };

    // getItem sits INSIDE the try: some browsers' private mode throws on the read
    // itself, and letting that escape kills the game at load time.
    try {
      const raw = this.#storage.getItem(KEY);
      if (!raw) return this.#root;

      const parsed = JSON.parse(raw);
      this.#root = {
        ...readSound(parsed),
        // Filter junk once at the door: JSON that parses but has the wrong shape
        // (arrays holding null, strings, numbers) must still yield usable progress
        // rather than throwing and killing the game at load.
        collections: Array.isArray(parsed?.collections)
          ? parsed.collections
              .filter((c) => c && typeof c === 'object')
              .map((c) => ({
                ...c,
                levels: Array.isArray(c.levels)
                  ? c.levels.filter((l) => l && typeof l === 'object')
                  : [],
              }))
          : [],
      };
    } catch (error) {
      // Corrupt or blocked: start over — never throw and kill the game.
      console.warn(`ProgressStore: could not read progress, starting fresh (${error.message})`);
      this.#root = { musicOn: true, sfxOn: true, collections: [] };
    }

    return this.#root;
  }
```

Đổi getter/setter `muted` (dòng 114-119) thành:

```js
  get musicOn() { return this.#data.musicOn; }

  set musicOn(value) {
    this.#data.musicOn = Boolean(value);
    this.#save();
  }

  get sfxOn() { return this.#data.sfxOn; }

  set sfxOn(value) {
    this.#data.sfxOn = Boolean(value);
    this.#save();
  }
```

Thêm hàm module-level ở cuối file, ngoài class:

```js
/**
 * Reads the two sound switches, migrating saves written before they were split.
 *
 * Those saves have a single `muted` flag. `muted: true` silenced the lot, so it becomes
 * both switches off. The old field is read but never written back — one save format is
 * enough to reason about.
 */
function readSound(parsed) {
  if (typeof parsed?.musicOn === 'boolean' || typeof parsed?.sfxOn === 'boolean') {
    return { musicOn: parsed.musicOn !== false, sfxOn: parsed.sfxOn !== false };
  }

  const on = !parsed?.muted;
  return { musicOn: on, sfxOn: on };
}
```

- [ ] **Step 4: Chạy, phải xanh**

Run: `cd web && node --test tests/progressStore.test.mjs`
Expected: PASS.

- [ ] **Step 5: Chạy toàn bộ**

Run: `cd web && npm test`
Expected: `mainMenu.test.mjs` ĐỎ (còn dùng `progress.muted`) — Task 11 sửa. Ghi lại.

- [ ] **Step 6: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/progress/progressStore.js web/tests/progressStore.test.mjs
git commit -m "ProgressStore: tách muted thành musicOn và sfxOn, kèm migrate"
```

---

### Task 9: AudioService — hai công tắc

**Files:**
- Modify: `web/src/audio/audioService.js`
- Test: `web/tests/audioService.test.mjs` (tạo mới)

**Interfaces:**
- Consumes: `ProgressStore.musicOn` / `.sfxOn` (Task 8).
- Produces: `AudioService` có `get/set musicOn`, `get/set sfxOn`. Getter/setter `muted` biến mất.

- [ ] **Step 1: Viết test đỏ**

`AudioService` dựng `Audio` trong constructor, thứ không có trong Node. Tiêm một fake qua global trước khi import.

Tạo `web/tests/audioService.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

/** Stands in for the browser's Audio element. Records what was asked of it. */
class FakeAudio {
  static made = [];

  constructor(src) {
    this.src = src;
    this.loop = false;
    this.volume = 1;
    this.preload = '';
    this.plays = 0;
    this.pauses = 0;
    FakeAudio.made.push(this);
  }

  play() { this.plays++; return Promise.resolve(); }
  pause() { this.pauses++; }
  cloneNode() { return new FakeAudio(this.src); }
}

globalThis.Audio = FakeAudio;

const { AudioService } = await import('../src/audio/audioService.js');

/** A stand-in for ProgressStore holding just the two switches. */
const fakeProgress = () => ({ musicOn: true, sfxOn: true });

function setup() {
  FakeAudio.made = [];
  const progress = fakeProgress();
  const audio = new AudioService(progress);
  // The music loop is the last one the constructor builds.
  const music = FakeAudio.made.at(-1);
  return { audio, progress, music };
}

test('unlock starts the music when it is switched on', () => {
  const { audio, music } = setup();

  audio.unlock();

  assert.equal(music.plays, 1);
});

test('unlock stays silent when the music is switched off', () => {
  const { audio, progress, music } = setup();
  progress.musicOn = false;

  audio.unlock();

  assert.equal(music.plays, 0);
});

test('switching the music off pauses the loop, on resumes it', () => {
  const { audio, music } = setup();
  audio.unlock();

  audio.musicOn = false;
  assert.equal(music.pauses, 1);

  audio.musicOn = true;
  assert.equal(music.plays, 2);
});

test('the two switches are independent — no music, still footsteps', () => {
  const { audio, music } = setup();
  audio.unlock();
  audio.musicOn = false;

  const before = FakeAudio.made.length;
  audio.play('step');

  assert.equal(music.pauses, 1, 'the music really did stop');
  assert.equal(FakeAudio.made.length, before + 1, 'and a step clip was still cloned and played');
});

test('switching effects off silences play but leaves the music alone', () => {
  const { audio, music } = setup();
  audio.unlock();

  audio.sfxOn = false;
  const before = FakeAudio.made.length;
  audio.play('step');

  assert.equal(FakeAudio.made.length, before, 'no clip should have been made');
  assert.equal(music.pauses, 0, 'the music switch was not touched');
});

test('the switches are written straight through to progress', () => {
  const { audio, progress } = setup();

  audio.musicOn = false;
  audio.sfxOn = false;

  assert.equal(progress.musicOn, false);
  assert.equal(progress.sfxOn, false);
});
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/audioService.test.mjs`
Expected: FAIL — `audio.musicOn` là `undefined`.

- [ ] **Step 3: Sửa AudioService**

Trong `web/src/audio/audioService.js`, thay khối `get muted` / `set muted` / `unlock` / `play` (dòng 36-61) bằng:

```js
  get musicOn() { return this.#progress.musicOn; }

  set musicOn(value) {
    this.#progress.musicOn = value;
    if (value) {
      // Nothing may play before the first interaction, so a switch flipped earlier than
      // that just records the choice; unlock() starts the loop when the time comes.
      if (this.#unlocked) void this.#music.play().catch(() => {});
    } else {
      this.#music.pause();
    }
  }

  get sfxOn() { return this.#progress.sfxOn; }

  set sfxOn(value) {
    this.#progress.sfxOn = value;
  }

  unlock() {
    if (this.#unlocked) return;
    this.#unlocked = true;
    if (this.musicOn) void this.#music.play().catch(() => {});
  }

  play(name) {
    if (!this.sfxOn) return;

    const source = this.#buffers.get(name);
    if (!source) return;

    // Clone so two sounds can overlap: sharing one node means fast key presses cut
    // the previous sound off mid-play.
    const clip = source.cloneNode();
    clip.volume = 0.7;
    void clip.play().catch(() => {});
  }
```

- [ ] **Step 4: Chạy, phải xanh**

Run: `cd web && node --test tests/audioService.test.mjs`
Expected: PASS, 6 test.

- [ ] **Step 5: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/audio/audioService.js web/tests/audioService.test.mjs
git commit -m "AudioService: công tắc nhạc nền và hiệu ứng tách riêng"
```

---

### Task 10: SettingsPanel

**Files:**
- Create: `web/src/ui/settingsPanel.js`
- Test: `web/tests/settingsPanel.test.mjs`

**Interfaces:**
- Consumes: không có module nào của game — panel chỉ nhận callback.
- Produces: `new SettingsPanel(rootEl, { onToggleMusic, onToggleSfx, getState, keyTarget })`, với `show()`, `hide()`, `refresh()`. `getState()` trả `{ musicOn, sfxOn }`. `keyTarget` mặc định `window`, tiêm được để test.

- [ ] **Step 1: Viết test đỏ**

Tạo `web/tests/settingsPanel.test.mjs`:

```js
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
```

- [ ] **Step 2: Chạy, phải đỏ**

Run: `cd web && node --test tests/settingsPanel.test.mjs`
Expected: FAIL — `Cannot find module '../src/ui/settingsPanel.js'`.

- [ ] **Step 3: Viết SettingsPanel**

Tạo `web/src/ui/settingsPanel.js`:

```js
/**
 * The settings overlay: one switch for the music, one for the effects.
 *
 * It lives outside every `.screen` because it opens from the main menu and from the
 * board alike — unlike the level-complete overlay, which sits inside `.stage` and so only
 * exists while a level is up.
 *
 * `keyTarget` is injected so tests can hand in a stand-in for `window`.
 */
export class SettingsPanel {
  #root;
  #musicBtn;
  #sfxBtn;
  #getState;
  #keyTarget;
  #open = false;

  constructor(rootEl, { onToggleMusic, onToggleSfx, getState, keyTarget = window }) {
    this.#root = rootEl;
    this.#musicBtn = rootEl.querySelector('#btn-music');
    this.#sfxBtn = rootEl.querySelector('#btn-sfx');
    this.#getState = getState;
    this.#keyTarget = keyTarget;

    this.#musicBtn.addEventListener('click', () => {
      onToggleMusic();
      this.refresh();
    });
    this.#sfxBtn.addEventListener('click', () => {
      onToggleSfx();
      this.refresh();
    });
    rootEl.querySelector('#btn-settings-close').addEventListener('click', () => this.hide());

    this.onKeyDown = this.onKeyDown.bind(this);
  }

  show() {
    this.refresh();
    this.#root.hidden = false;

    // Guard against a second show: addEventListener would take the same function twice
    // and every key would be handled twice over.
    if (this.#open) return;
    this.#open = true;
    this.#keyTarget.addEventListener('keydown', this.onKeyDown, true);
  }

  hide() {
    this.#root.hidden = true;
    if (!this.#open) return;
    this.#open = false;
    this.#keyTarget.removeEventListener('keydown', this.onKeyDown, true);
  }

  refresh() {
    const { musicOn, sfxOn } = this.#getState();
    label(this.#musicBtn, 'Music', musicOn);
    label(this.#sfxBtn, 'Sound effects', sfxOn);
  }

  /**
   * Registered on the CAPTURE phase, so it runs before InputRouter's listener on the same
   * window and can stop it. Without this the arrow keys would walk the player about
   * behind the overlay, and Escape would leave the level rather than close the panel.
   */
  onKeyDown(event) {
    event.stopPropagation();
    if (event.code === 'Escape') this.hide();
  }
}

function label(button, name, on) {
  button.textContent = `${name}: ${on ? 'on' : 'off'}`;
  button.setAttribute('aria-pressed', String(on));
}
```

- [ ] **Step 4: Chạy, phải xanh**

Run: `cd web && node --test tests/settingsPanel.test.mjs`
Expected: PASS, 9 test.

- [ ] **Step 5: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/ui/settingsPanel.js web/tests/settingsPanel.test.mjs
git commit -m "SettingsPanel: overlay hai công tắc âm thanh, nuốt phím khi mở"
```

---

### Task 11: Nối Settings và bỏ hai nút mute cũ

**Files:**
- Modify: `web/index.html`
- Modify: `web/src/ui/mainMenu.js`
- Modify: `web/src/main.js`
- Modify: `web/styles/ui.css`
- Test: `web/tests/mainMenu.test.mjs`

**Interfaces:**
- Consumes: `SettingsPanel` (Task 10); `AudioService.musicOn`/`.sfxOn` (Task 9).
- Produces: `MainMenu` nhận `{ onContinue, onSelect, onSettings }` — `onToggleMute` biến mất.

- [ ] **Step 1: Sửa markup**

Trong `web/index.html`:

Đổi `panel__actions` của menu (dòng 16-20) thành:

```html
      <div class="panel__actions">
        <button class="btn btn--big" id="btn-continue" type="button">Continue</button>
        <button class="btn btn--big" id="btn-levels" type="button">Select level</button>
        <button class="btn btn--big" id="btn-menu-settings" type="button">⚙ Settings</button>
      </div>
```

Đổi `<header class="hud" id="hud">` (dòng 34-40) thành — bỏ nút 🔊:

```html
    <header class="hud" id="hud">
      <span class="hud__name" id="hud-name">Level 1</span>
      <span class="hud__stat">Moves <b id="hud-moves">0</b></span>
      <span class="hud__stat">Pushes <b id="hud-pushes">0</b></span>
      <span class="hud__spacer"></span>
    </header>
```

Đổi `<footer class="toolbar">` thành:

```html
    <footer class="toolbar">
      <button class="btn" id="btn-undo" type="button">↶ Undo</button>
      <button class="btn" id="btn-hint" type="button">💡 Hint</button>
      <button class="btn" id="btn-restart" type="button">⟳ Restart</button>
      <button class="btn" id="btn-settings" type="button">⚙ Settings</button>
      <button class="btn" id="btn-exit" type="button">← Select level</button>
    </footer>
```

Thêm overlay ngay trước `<script type="module" ...>`, ngoài mọi `<section>`/`<main>`:

```html
  <div class="overlay overlay--modal" id="settings" hidden>
    <div class="panel">
      <h2 class="panel__title">Settings</h2>
      <div class="panel__actions">
        <button class="btn btn--big" id="btn-music" type="button" aria-pressed="true">Music: on</button>
        <button class="btn btn--big" id="btn-sfx" type="button" aria-pressed="true">Sound effects: on</button>
        <button class="btn btn--big" id="btn-settings-close" type="button">Close</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Sửa CSS**

Trong `web/styles/ui.css`:

Đổi `.toolbar` (dòng 34-41) thành:

```css
.toolbar {
  display: flex;
  flex-wrap: wrap;      /* five buttons now — they must be able to drop a line */
  gap: 8px;
  justify-content: center;
  padding: 12px;
  background: var(--panel);
  border-top: 1px solid var(--panel-line);
}
```

Thêm ngay sau luật `.overlay[hidden]` (dòng 135):

```css
/*
 * The settings overlay sits outside every `.screen`, so it cannot be positioned against
 * `.stage` the way the level-complete overlay is. Fixed to the viewport instead, and
 * above everything, because it opens from the menu and from the board alike.
 */
.overlay--modal {
  position: fixed;
  z-index: 10;
}
```

- [ ] **Step 3: Sửa test của MainMenu**

Trong `web/tests/mainMenu.test.mjs`:

Trong `setup()`, đổi danh sách id và callback:

```js
  for (const id of ['btn-continue', 'btn-levels', 'btn-menu-settings']) {
    root.append(withId(id, 'button'));
  }

  const fired = [];
  const menu = new MainMenu(root, {
    onContinue: () => fired.push('continue'),
    onSelect: () => fired.push('select'),
    onSettings: () => fired.push('settings'),
  });
```

Xoá hẳn test `'the mute button reflects the stored setting'`.

Đổi test cuối thành:

```js
test('each button fires its own callback', () => {
  const { menu, fired, el } = setup();
  menu.refresh(makeProgress(), COLLECTION, levels(3));

  el('btn-continue').dispatch('click');
  el('btn-levels').dispatch('click');
  el('btn-menu-settings').dispatch('click');

  assert.deepEqual(fired, ['continue', 'select', 'settings']);
});
```

- [ ] **Step 4: Chạy, phải đỏ**

Run: `cd web && node --test tests/mainMenu.test.mjs`
Expected: FAIL — `MainMenu` vẫn tìm `#btn-menu-mute` và trả về `null`, ném lỗi ở `addEventListener`.

- [ ] **Step 5: Sửa MainMenu**

Thay toàn bộ `web/src/ui/mainMenu.js` bằng:

```js
/** The first screen: continue, pick a level, open the settings. */
export class MainMenu {
  #continueBtn;

  constructor(rootEl, { onContinue, onSelect, onSettings }) {
    this.#continueBtn = rootEl.querySelector('#btn-continue');

    this.#continueBtn.addEventListener('click', onContinue);
    rootEl.querySelector('#btn-levels').addEventListener('click', onSelect);
    rootEl.querySelector('#btn-menu-settings').addEventListener('click', onSettings);
  }

  refresh(progress, collectionName, levels) {
    const last = Math.min(progress.getLastPlayedIndex(collectionName), levels.length - 1);
    // The number shown comes from the level's name, not index plus one — another
    // level set may use names that are not numbers.
    const name = levels[last]?.name;
    this.#continueBtn.textContent = last > 0 && name ? `Continue (level ${name})` : 'Play';
  }
}
```

- [ ] **Step 6: Chạy, phải xanh**

Run: `cd web && node --test tests/mainMenu.test.mjs`
Expected: PASS.

- [ ] **Step 7: Nối trong main.js**

Trong `web/src/main.js`:

Thêm vào khối import:

```js
import { SettingsPanel } from './ui/settingsPanel.js';
```

Đổi mục `menu` trong `panels` — bỏ `onToggleMute`, thêm `onSettings`:

```js
  menu: new MainMenu(document.body, {
    onContinue: () => {
      // Clamp it: progress can point past the level set (the set shrank, or
      // localStorage was hand-edited), and playLevel given a stray index bails out
      // silently after leaving the screen — the button then looks broken.
      const last = progress.getLastPlayedIndex(collection.collectionName);
      flow.playLevel(Math.min(Math.max(last, 0), collection.levels.length - 1));
    },
    onSelect: () => flow.showLevelSelect(),
    onSettings: () => panels.settings.show(),
  }),
```

Thêm mục `settings` vào `panels`, ngay sau `levelComplete`:

```js
  settings: new SettingsPanel(document.getElementById('settings'), {
    onToggleMusic: () => { audio.musicOn = !audio.musicOn; },
    onToggleSfx: () => { audio.sfxOn = !audio.sfxOn; },
    getState: () => ({ musicOn: audio.musicOn, sfxOn: audio.sfxOn }),
  }),
```

Xoá hẳn khối `hudMute` / `refreshMuteButton` (dòng 67-76) và thay bằng:

```js
document.getElementById('btn-settings').addEventListener('click', () => panels.settings.show());
```

- [ ] **Step 8: Chạy toàn bộ test**

Run: `cd web && npm test`
Expected: PASS toàn bộ, không còn file nào đỏ.

- [ ] **Step 9: Thử tay trong trình duyệt**

Run: `cd web && python -m http.server 8000`, mở `http://localhost:8000`.

Kiểm từng mục:
- Menu chính: ba nút, không còn "Sound: on".
- Bấm ⚙ Settings ở menu → overlay hiện, tắt Music → nhạc dừng ngay.
- Vào một màn: HUD không còn 🔊; thanh dưới có 5 nút.
- Mở Settings khi đang chơi, bấm mũi tên → nhân vật KHÔNG nhúc nhích. Bấm Esc → overlay đóng, vẫn ở trong màn.
- Tắt Music, để Sound effects bật → đi một bước vẫn có tiếng.
- Tải lại trang → hai công tắc giữ nguyên trạng thái.
- Thu hẹp cửa sổ → thanh 5 nút xuống dòng, không tràn.

- [ ] **Step 10: Commit**

```bash
cd d:/Hung/Sokoban
git add web/index.html web/src/ui/mainMenu.js web/src/main.js web/styles/ui.css web/tests/mainMenu.test.mjs
git commit -m "Nối Settings vào menu và thanh nút, bỏ hai nút mute cũ"
```

---

## Kiểm tra cuối

- [ ] `cd web && npm test` — xanh toàn bộ.
- [ ] `grep -rn "redo\|Redo\|muted\|btn-mute" web/src web/index.html` — không còn kết quả nào ngoài hàm `readSound` trong `progressStore.js` (chỗ đó đọc `muted` để migrate, đúng theo thiết kế).
- [ ] Chơi thử màn 1 tới màn 5 trong trình duyệt: undo, restart, hint, settings, giải xong màn đều hoạt động.
- [ ] Bấm Hint ở một màn cao (ví dụ 120): hoặc ra gợi ý, hoặc hiện `No hint` rồi tự trả về `💡 Hint`. Không được treo và không được đơ tab.
