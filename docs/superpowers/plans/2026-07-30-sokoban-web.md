# Sokoban bản web — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại game Sokoban bằng HTML + CSS + JavaScript thuần trong thư mục `web/`, đủ tính năng để thay hẳn bản Unity.

**Architecture:** Lõi luật chơi là JS thuần không đụng DOM (port một-đối-một từ `Assets/Scripts/Core` và `Assets/Scripts/Levels`), nên `node --test` chạy được mà không cần trình duyệt. Lớp hiển thị vẽ phần tĩnh của màn một lần bằng CSS Grid, còn người chơi và hộp là phần tử `position:absolute` di chuyển bằng `transform` + CSS transition.

**Tech Stack:** HTML5, CSS3, JavaScript ES module, `node --test` (Node 24), GitHub Actions + GitHub Pages.

**Spec:** [2026-07-30-sokoban-web-design.md](../specs/2026-07-30-sokoban-web-design.md)

> **Trạng thái:** đã thi công xong. Đây là bản ghi lịch sử, không phải việc đang chờ làm — các ô
> `- [ ]` bên dưới chưa bao giờ được tick chứ không phải còn dở. Project Unity đã bị xoá khỏi repo
> sau đó (`26f993f`), nên mọi đường dẫn `Assets/...` trong tài liệu này đều **không còn tồn tại**:
> chúng ghi lại nơi code được port từ đó và các file listing tại thời điểm viết. Cách chạy và cách
> đổi bộ màn hiện tại xem [web/README.md](../../../web/README.md), không lấy theo file này.

## Global Constraints

- Không framework, không build step, không dependency runtime. `web/package.json` chỉ khai báo `"type": "module"` và script `test`; **không** có `dependencies` hay `devDependencies`.
- `src/core/**` và `src/levels/**` **không được** đụng `document`, `window`, `localStorage`, `Audio`, hay `fetch`. Chỉ `src/view/**`, `src/ui/**`, `src/input/**`, `src/audio/**`, `src/progress/**`, `src/main.js` được phép.
- Chiều dài animation một nước đi: **120ms**.
- Kích thước ô `--cell` kẹp trong **20–64px**.
- Chỉ số màn trong code và trong tiến độ đếm **từ 0**. Số hiển thị lấy từ trường `name` của màn.
- Khoá `localStorage`: `sokoban.progress`. Tên bộ màn: `Microban`.
- Bảy ký tự Sokoban: `#` tường · `` (dấu cách) nền · `@` người · `+` người trên đích · `$` hộp · `*` hộp trên đích · `.` đích.
- Ô đích dùng `mark_o.png`, **không** dùng `goal.png` (art cũ).
- Toàn bộ chú thích trong code viết bằng tiếng Việt, theo đúng lệ của repo.
- Mỗi task kết thúc bằng một commit. Thông báo commit viết tiếng Việt, mô tả *tại sao*, không phải liệt kê file.

## Ghi chú lệch so với spec

Spec liệt kê `view/boardRenderer.js` và `view/moveAnimator.js`. Kế hoạch này thêm **`view/levelPlayer.js`** làm nơi chứa vòng lặp chơi (nhận lệnh → gọi session → chạy animation → đệm 1 nước). Bản Unity cũng tách đúng như vậy (`Assets/Scripts/View/LevelPlayer.cs`); không có nó thì logic này phải nhét vào `gameFlow.js` vốn đã lo việc chuyển màn hình.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `web/package.json` | Bật ESM cho `.js`, khai báo `npm test` |
| `web/src/levels/sokobanChars.js` | Bảy ký tự + `isGrid` / `isContent` + `countPieces` |
| `web/src/core/direction.js` | Bốn hướng + vector |
| `web/src/core/board.js` | Lưới tĩnh, vị trí người, tập hộp, `isSolved` |
| `web/src/core/moveResolver.js` | `resolve` / `apply` / `revert` |
| `web/src/core/moveHistory.js` | Stack undo + nhánh redo |
| `web/src/core/gameSession.js` | Board + history + bộ đếm + sự kiện |
| `web/src/levels/parseMicroban.js` | Text Microban → danh sách màn + lỗi |
| `web/src/levels/levelValidator.js` | Kiểm tra cấu trúc một màn |
| `web/src/levels/microban.json` | 155 màn, sinh ra và commit |
| `web/tools/import-microban.mjs` | Sinh `microban.json` từ `.txt` |
| `web/src/view/boardRenderer.js` | Dựng lưới tĩnh + actor, tra cứu phần tử theo ô |
| `web/src/view/moveAnimator.js` | Tween `transform`, đợi `transitionend` |
| `web/src/view/levelPlayer.js` | Vòng lặp chơi + đệm input |
| `web/src/input/inputRouter.js` | Bàn phím + nút bấm → lệnh |
| `web/src/progress/progressStore.js` | Đọc/ghi tiến độ vào `localStorage` |
| `web/src/audio/audioService.js` | SFX + nhạc nền + tắt tiếng |
| `web/src/ui/gameFlow.js` | Điều phối màn hình |
| `web/src/ui/mainMenu.js` · `levelSelect.js` · `hud.js` · `levelComplete.js` | Từng panel |
| `web/src/main.js` | Bootstrap |
| `web/styles/base.css` · `board.css` · `ui.css` | Biến màu · tile và actor · panel |
| `web/editor/index.html` · `editor.js` | Level editor cho dev |
| `.github/workflows/pages.yml` | Deploy `web/` lên Pages |

---

### Task 1: Khung dự án, hằng ký tự, hướng đi

**Files:**
- Create: `web/package.json`
- Create: `web/src/levels/sokobanChars.js`
- Create: `web/src/core/direction.js`
- Test: `web/tests/direction.test.mjs`
- Test: `web/tests/sokobanChars.test.mjs`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `sokobanChars.js`: `WALL`, `FLOOR`, `PLAYER`, `PLAYER_ON_GOAL`, `BOX`, `BOX_ON_GOAL`, `GOAL` (đều là `string` một ký tự); `isGrid(c: string): boolean`; `isContent(c: string): boolean`; `countPieces(rows: string[]): { players: number, boxes: number, goals: number, playerPos: {x,y}|null }`
  - `direction.js`: `Direction` (object đông cứng với 4 khoá `Up`/`Down`/`Left`/`Right`, giá trị là chính chuỗi đó); `toDelta(dir: string): {dx: number, dy: number}`

`countPieces` là hàm đếm **dùng chung** cho `parseMicroban` (Task 5) và `levelValidator` (Task 6).
Hai chỗ đó đều cần đúng ba con số này; viết riêng mỗi nơi một vòng lặp thì đổi lệ đếm sau này phải
sửa hai chỗ. `playerPos` trả kèm vì validator cần điểm bắt đầu để loang kiểm tra tường bao kín.

- [ ] **Step 1: Tạo `web/package.json`**

```json
{
  "name": "sokoban-web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Sokoban chạy trên trình duyệt, HTML + CSS + JavaScript thuần",
  "scripts": {
    "test": "node --test"
  }
}
```

`"type": "module"` là bắt buộc: không có nó, Node coi `.js` là CommonJS và mọi `import` trong `src/` sẽ nổ.

- [ ] **Step 2: Viết test cho `direction.js`**

Tạo `web/tests/direction.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction, toDelta } from '../src/core/direction.js';

test('mỗi hướng cho ra đúng một vector đơn vị', () => {
  assert.deepEqual(toDelta(Direction.Up), { dx: 0, dy: -1 });
  assert.deepEqual(toDelta(Direction.Down), { dx: 0, dy: 1 });
  assert.deepEqual(toDelta(Direction.Left), { dx: -1, dy: 0 });
  assert.deepEqual(toDelta(Direction.Right), { dx: 1, dy: 0 });
});

test('hướng lạ thì ném lỗi thay vì trả về undefined', () => {
  assert.throws(() => toDelta('Sideways'), /Sideways/);
});
```

- [ ] **Step 3: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/core/direction.js`.

- [ ] **Step 4: Viết `web/src/core/direction.js`**

```js
/** Bốn hướng đi. Giá trị trùng tên khoá để log ra đọc được ngay. */
export const Direction = Object.freeze({
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
});

// y tăng xuống dưới, giống thứ tự hàng trong LevelData.rows.
const DELTAS = Object.freeze({
  Up: { dx: 0, dy: -1 },
  Down: { dx: 0, dy: 1 },
  Left: { dx: -1, dy: 0 },
  Right: { dx: 1, dy: 0 },
});

export function toDelta(dir) {
  const delta = DELTAS[dir];
  // Ném lỗi chứ không trả undefined: hướng sai mà im lặng thì lỗi sẽ hiện ra ở
  // tận chỗ cộng toạ độ, xa chỗ gây ra nó.
  if (!delta) throw new Error(`Hướng không hợp lệ: ${dir}`);
  return delta;
}
```

- [ ] **Step 5: Chạy test để chắc chắn nó xanh**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 2 test.

- [ ] **Step 6: Viết test cho `sokobanChars.js`**

Tạo `web/tests/sokobanChars.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isGrid, isContent, countPieces } from '../src/levels/sokobanChars.js';

test('isGrid nhận đúng bảy ký tự lưới', () => {
  for (const c of ['#', ' ', '@', '+', '$', '*', '.']) {
    assert.equal(isGrid(c), true, `${JSON.stringify(c)} phải là ký tự lưới`);
  }
});

test('isGrid từ chối chữ, số và ký tự lạ', () => {
  for (const c of ['a', 'T', '1', ':', '\t']) {
    assert.equal(isGrid(c), false, `${JSON.stringify(c)} không phải ký tự lưới`);
  }
});

test('isContent loại nền trống ra khỏi ký tự lưới', () => {
  assert.equal(isContent(' '), false);
  assert.equal(isContent('#'), true);
  assert.equal(isContent('.'), true);
  assert.equal(isContent('a'), false);
});

test('countPieces đếm đúng người chơi, hộp và đích', () => {
  const counts = countPieces(['#####', '#@$.#', '#####']);
  assert.equal(counts.players, 1);
  assert.equal(counts.boxes, 1);
  assert.equal(counts.goals, 1);
  assert.deepEqual(counts.playerPos, { x: 1, y: 1 });
});

test('countPieces tính * và + vào cả hai phía', () => {
  // '*' vừa là hộp vừa là đích; '+' vừa là người vừa là đích.
  const counts = countPieces(['#+*#']);
  assert.equal(counts.players, 1);
  assert.equal(counts.boxes, 1);
  assert.equal(counts.goals, 2);
  assert.deepEqual(counts.playerPos, { x: 1, y: 0 });
});

test('countPieces trên lưới không có người trả playerPos null', () => {
  assert.equal(countPieces(['####']).playerPos, null);
});
```

- [ ] **Step 7: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/levels/sokobanChars.js`.

- [ ] **Step 8: Viết `web/src/levels/sokobanChars.js`**

```js
/** Bảy ký tự của định dạng Sokoban chuẩn. */
export const WALL = '#';
export const FLOOR = ' ';
export const PLAYER = '@';
export const PLAYER_ON_GOAL = '+';
export const BOX = '$';
export const BOX_ON_GOAL = '*';
export const GOAL = '.';

const GRID_CHARS = new Set([WALL, FLOOR, PLAYER, PLAYER_ON_GOAL, BOX, BOX_ON_GOAL, GOAL]);

export function isGrid(c) {
  return GRID_CHARS.has(c);
}

/** Ký tự lưới khác nền trống — dùng để phân biệt hàng lưới với dòng chữ. */
export function isContent(c) {
  return isGrid(c) && c !== FLOOR;
}

/**
 * Đếm người chơi, hộp và đích trên một mảng hàng, kèm vị trí người chơi.
 *
 * Dùng chung cho parser và validator: cả hai đều cần đúng ba con số này, và
 * lệ đếm có chỗ dễ quên — '*' tính cả vào hộp lẫn đích, '+' tính cả vào người
 * lẫn đích. Viết riêng mỗi nơi một vòng lặp thì sửa lệ phải sửa hai chỗ.
 */
export function countPieces(rows) {
  let players = 0, boxes = 0, goals = 0;
  let playerPos = null;

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === PLAYER || c === PLAYER_ON_GOAL) {
        players++;
        playerPos = { x, y };
      }
      if (c === BOX || c === BOX_ON_GOAL) boxes++;
      if (c === GOAL || c === BOX_ON_GOAL || c === PLAYER_ON_GOAL) goals++;
    }
  }

  return { players, boxes, goals, playerPos };
}
```

- [ ] **Step 9: Chạy test để chắc chắn nó xanh**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 8 test.

- [ ] **Step 10: Commit**

```bash
git add web/package.json web/src/core/direction.js web/src/levels/sokobanChars.js web/tests/direction.test.mjs web/tests/sokobanChars.test.mjs
git commit -m "Dựng khung web/ với hằng ký tự và hướng đi

Bật type=module ngay từ đầu vì không có nó thì mọi import trong src/ sẽ
hỏng khi chạy node --test. countPieces để sẵn ở đây vì cả parser lẫn
validator sẽ cần đúng phép đếm đó."
```

---

### Task 2: `Board` — lưới tĩnh và trạng thái màn

**Files:**
- Create: `web/src/core/board.js`
- Create: `web/tests/helpers.mjs`
- Test: `web/tests/board.test.mjs`

**Interfaces:**
- Consumes: `sokobanChars.js` (`WALL`, `FLOOR`, `GOAL`, `BOX`, `BOX_ON_GOAL`, `PLAYER`, `PLAYER_ON_GOAL`)
- Produces:
  - `CellType`: object đông cứng `{ Wall: 'Wall', Floor: 'Floor', Goal: 'Goal' }`
  - `boxKey(x: number, y: number): string` — trả `"x,y"`
  - `parseBoxKey(key: string): {x: number, y: number}`
  - `class Board`: `width`, `height`, `player: {x, y}`, `boxes: Set<string>`, `cellAt(x, y): string`, `hasBox(x, y): boolean`, `get isSolved(): boolean`, static `fromLevel(level): Board`
  - `level` là object `{ name: string, width: number, height: number, rows: string[] }`
  - `web/tests/helpers.mjs`: `makeLevel(rows: string[], name?: string): level`, `makeBoard(rows: string[]): Board`

- [ ] **Step 1: Viết helper dùng chung cho test**

Tạo `web/tests/helpers.mjs`:

```js
import { Board } from '../src/core/board.js';

/** Dựng một LevelData từ mảng hàng, tự pad cho các hàng bằng nhau. */
export function makeLevel(rows, name = 'test') {
  const width = Math.max(...rows.map((r) => r.length));
  return { name, width, height: rows.length, rows: rows.map((r) => r.padEnd(width)) };
}

export function makeBoard(rows) {
  return Board.fromLevel(makeLevel(rows));
}
```

- [ ] **Step 2: Viết test cho `board.js`**

Tạo `web/tests/board.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Board, CellType, boxKey, parseBoxKey } from '../src/core/board.js';
import { makeBoard } from './helpers.mjs';

test('fromLevel đọc đúng tường, nền và ô đích', () => {
  const board = makeBoard([
    '###',
    '#.#',
    '###',
  ]);
  assert.equal(board.cellAt(0, 0), CellType.Wall);
  assert.equal(board.cellAt(1, 1), CellType.Goal);
  assert.equal(board.width, 3);
  assert.equal(board.height, 3);
});

test('ô ngoài lưới coi như tường', () => {
  const board = makeBoard(['@']);
  assert.equal(board.cellAt(-1, 0), CellType.Wall);
  assert.equal(board.cellAt(0, -1), CellType.Wall);
  assert.equal(board.cellAt(1, 0), CellType.Wall);
  assert.equal(board.cellAt(0, 1), CellType.Wall);
});

test('người chơi trên đích vừa đặt vị trí người vừa là ô đích', () => {
  const board = makeBoard(['+']);
  assert.deepEqual(board.player, { x: 0, y: 0 });
  assert.equal(board.cellAt(0, 0), CellType.Goal);
});

test('hộp trên đích vừa vào tập hộp vừa là ô đích', () => {
  const board = makeBoard(['*']);
  assert.equal(board.hasBox(0, 0), true);
  assert.equal(board.cellAt(0, 0), CellType.Goal);
});

test('isSolved đúng khi mọi hộp nằm trên đích', () => {
  assert.equal(makeBoard(['#####', '#@ *#', '#####']).isSolved, true);
  assert.equal(makeBoard(['#####', '#@ $#', '#####']).isSolved, false);
});

test('màn không có hộp nào thì coi như đã giải', () => {
  assert.equal(makeBoard(['#####', '#@  #', '#####']).isSolved, true);
});

test('hàng ngắn hơn width được coi là nền trống', () => {
  const board = Board.fromLevel({ name: 't', width: 4, height: 1, rows: ['#@'] });
  assert.equal(board.cellAt(3, 0), CellType.Floor);
});

test('boxKey và parseBoxKey đi ngược nhau', () => {
  assert.equal(boxKey(3, 7), '3,7');
  assert.deepEqual(parseBoxKey('3,7'), { x: 3, y: 7 });
});
```

- [ ] **Step 3: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/core/board.js`.

- [ ] **Step 4: Viết `web/src/core/board.js`**

```js
import {
  WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, PLAYER, PLAYER_ON_GOAL,
} from '../levels/sokobanChars.js';

export const CellType = Object.freeze({
  Wall: 'Wall',
  Floor: 'Floor',
  Goal: 'Goal',
});

/**
 * Hộp lưu trong Set dưới dạng khoá chuỗi "x,y". JS so sánh object theo tham chiếu
 * nên Set chứa {x,y} sẽ không nhận ra hai toạ độ bằng nhau — đây là khác biệt bắt
 * buộc so với HashSet<Vector2Int> bên C#.
 */
export const boxKey = (x, y) => `${x},${y}`;

export function parseBoxKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/** Trạng thái một màn đang chơi. Lưới tĩnh không đổi; người chơi và hộp thì đổi. */
export class Board {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    // statics[y][x] — cùng thứ tự với LevelData.rows nên đọc code đỡ phải đảo đầu.
    this.statics = Array.from({ length: height }, () => new Array(width).fill(CellType.Floor));
    this.player = { x: 0, y: 0 };
    this.boxes = new Set();
  }

  /** Ngoài lưới coi như tường, nên nơi khác không cần kiểm tra biên. */
  cellAt(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return CellType.Wall;
    return this.statics[y][x];
  }

  hasBox(x, y) {
    return this.boxes.has(boxKey(x, y));
  }

  get isSolved() {
    for (const key of this.boxes) {
      const { x, y } = parseBoxKey(key);
      if (this.cellAt(x, y) !== CellType.Goal) return false;
    }
    return true;
  }

  static fromLevel(level) {
    const board = new Board(level.width, level.height);

    for (let y = 0; y < level.height; y++) {
      const row = level.rows[y];
      for (let x = 0; x < level.width; x++) {
        // Hàng ngắn hơn width thì phần thiếu là nền trống.
        const c = x < row.length ? row[x] : FLOOR;

        if (c === WALL) board.statics[y][x] = CellType.Wall;
        else if (c === GOAL || c === BOX_ON_GOAL || c === PLAYER_ON_GOAL) board.statics[y][x] = CellType.Goal;
        else board.statics[y][x] = CellType.Floor;

        if (c === PLAYER || c === PLAYER_ON_GOAL) board.player = { x, y };
        if (c === BOX || c === BOX_ON_GOAL) board.boxes.add(boxKey(x, y));
      }
    }

    return board;
  }
}
```

- [ ] **Step 5: Chạy test để chắc chắn nó xanh**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 16 test (8 của Task 1 + 8 mới).

- [ ] **Step 6: Commit**

```bash
git add web/src/core/board.js web/tests/board.test.mjs web/tests/helpers.mjs
git commit -m "Thêm Board với tập hộp dạng khoá chuỗi

Set chứa object toạ độ sẽ so sánh theo tham chiếu nên không nhận ra hai ô
trùng nhau; khoá \"x,y\" là cách rẻ nhất để giữ đúng ngữ nghĩa của HashSet."
```

---

### Task 3: `moveResolver` — luật đi và đẩy

**Files:**
- Create: `web/src/core/moveResolver.js`
- Test: `web/tests/moveResolver.test.mjs`

**Interfaces:**
- Consumes: `board.js` (`Board`, `CellType`, `boxKey`), `direction.js` (`Direction`, `toDelta`)
- Produces:
  - `resolve(board: Board, dir: string): Move` — hàm thuần, **không** đổi board
  - `Move` là object thường: `{ dir: string, blocked: boolean, push: boolean, from: {x,y}, to: {x,y}, boxFrom: {x,y}|null, boxTo: {x,y}|null }`. Khi `blocked` là `true` thì `to` bằng `from`.
  - `apply(board: Board, move: Move): void`
  - `revert(board: Board, move: Move): void`

- [ ] **Step 1: Viết test cho `moveResolver.js`**

Tạo `web/tests/moveResolver.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { resolve, apply, revert } from '../src/core/moveResolver.js';
import { makeBoard } from './helpers.mjs';

test('đi vào ô trống là nước đi thường', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.blocked, false);
  assert.equal(move.push, false);
  assert.deepEqual(move.from, { x: 1, y: 1 });
  assert.deepEqual(move.to, { x: 2, y: 1 });
  assert.equal(move.boxFrom, null);
});

test('đi vào tường thì bị chặn và không nhúc nhích', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Left);

  assert.equal(move.blocked, true);
  assert.deepEqual(move.to, move.from);
});

test('đẩy hộp vào ô trống là nước đẩy', () => {
  const board = makeBoard(['#####', '#@$ #', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.blocked, false);
  assert.equal(move.push, true);
  assert.deepEqual(move.to, { x: 2, y: 1 });
  assert.deepEqual(move.boxFrom, { x: 2, y: 1 });
  assert.deepEqual(move.boxTo, { x: 3, y: 1 });
});

test('đẩy hộp vào tường thì bị chặn', () => {
  const board = makeBoard(['####', '#@$#', '####']);
  assert.equal(resolve(board, Direction.Right).blocked, true);
});

test('không đẩy được hai hộp liền nhau', () => {
  const board = makeBoard(['######', '#@$$ #', '######']);
  assert.equal(resolve(board, Direction.Right).blocked, true);
});

test('đẩy được hộp lên ô đích', () => {
  const board = makeBoard(['#####', '#@$.#', '#####']);
  const move = resolve(board, Direction.Right);

  assert.equal(move.push, true);
  apply(board, move);
  assert.equal(board.isSolved, true);
});

test('resolve không đổi board', () => {
  const board = makeBoard(['#####', '#@$ #', '#####']);
  resolve(board, Direction.Right);

  assert.deepEqual(board.player, { x: 1, y: 1 });
  assert.equal(board.hasBox(2, 1), true);
});

test('apply rồi revert quay về đúng trạng thái cũ', () => {
  const board = makeBoard(['#####', '#@$ #', '#####']);
  const move = resolve(board, Direction.Right);

  apply(board, move);
  assert.deepEqual(board.player, { x: 2, y: 1 });
  assert.equal(board.hasBox(3, 1), true);
  assert.equal(board.hasBox(2, 1), false);

  revert(board, move);
  assert.deepEqual(board.player, { x: 1, y: 1 });
  assert.equal(board.hasBox(2, 1), true);
  assert.equal(board.hasBox(3, 1), false);
});

test('apply và revert bỏ qua nước bị chặn', () => {
  const board = makeBoard(['#####', '#@  #', '#####']);
  const move = resolve(board, Direction.Left);

  apply(board, move);
  assert.deepEqual(board.player, { x: 1, y: 1 });
  revert(board, move);
  assert.deepEqual(board.player, { x: 1, y: 1 });
});

test('đẩy hộp đang đúng đích ra ngoài thì mất trạng thái thắng', () => {
  const board = makeBoard(['######', '#@*  #', '######']);
  assert.equal(board.isSolved, true);   // hộp duy nhất đang nằm trên đích

  const move = resolve(board, Direction.Right);
  apply(board, move);

  assert.equal(board.hasBox(3, 1), true);
  // Trạng thái thắng tính lại từ bàn cờ chứ không đếm tăng giảm, nên nó mất ngay.
  assert.equal(board.isSolved, false);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/core/moveResolver.js`.

- [ ] **Step 3: Viết `web/src/core/moveResolver.js`**

```js
import { CellType, boxKey } from './board.js';
import { toDelta } from './direction.js';

/** Tính kết quả một nước đi. Hàm thuần — không đổi board. */
export function resolve(board, dir) {
  const { dx, dy } = toDelta(dir);
  const from = { ...board.player };
  const to = { x: from.x + dx, y: from.y + dy };

  const blockedMove = {
    dir, blocked: true, push: false,
    from, to: { ...from }, boxFrom: null, boxTo: null,
  };

  if (board.cellAt(to.x, to.y) === CellType.Wall) return blockedMove;

  if (board.hasBox(to.x, to.y)) {
    const boxTo = { x: to.x + dx, y: to.y + dy };
    // Đẩy vào tường hoặc vào hộp khác đều không được.
    if (board.cellAt(boxTo.x, boxTo.y) === CellType.Wall || board.hasBox(boxTo.x, boxTo.y)) {
      return blockedMove;
    }
    return { dir, blocked: false, push: true, from, to, boxFrom: { ...to }, boxTo };
  }

  return { dir, blocked: false, push: false, from, to, boxFrom: null, boxTo: null };
}

export function apply(board, move) {
  if (move.blocked) return;

  if (move.push) {
    board.boxes.delete(boxKey(move.boxFrom.x, move.boxFrom.y));
    board.boxes.add(boxKey(move.boxTo.x, move.boxTo.y));
  }
  board.player = { ...move.to };
}

export function revert(board, move) {
  if (move.blocked) return;

  if (move.push) {
    board.boxes.delete(boxKey(move.boxTo.x, move.boxTo.y));
    board.boxes.add(boxKey(move.boxFrom.x, move.boxFrom.y));
  }
  board.player = { ...move.from };
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 26 test.

- [ ] **Step 5: Commit**

```bash
git add web/src/core/moveResolver.js web/tests/moveResolver.test.mjs
git commit -m "Thêm luật đi và đẩy dưới dạng hàm thuần

resolve tách khỏi apply để undo dùng lại được đúng object nước đi thay vì
phải suy ngược trạng thái từ bàn cờ."
```

---

### Task 4: `MoveHistory` và `GameSession`

**Files:**
- Create: `web/src/core/moveHistory.js`
- Create: `web/src/core/gameSession.js`
- Test: `web/tests/moveHistory.test.mjs`
- Test: `web/tests/gameSession.test.mjs`

**Interfaces:**
- Consumes: `board.js`, `moveResolver.js`, `direction.js`
- Produces:
  - `class MoveHistory`: `get canUndo(): boolean`, `get canRedo(): boolean`, `record(move): void`, `popForUndo(): Move`, `popForRedo(): Move`, `clear(): void`
  - `class GameSession`: `constructor(level)`, `board: Board`, `get moves(): number`, `get pushes(): number`, `get isSolved(): boolean`, `get canUndo(): boolean`, `get canRedo(): boolean`, `get levelName(): string`, `onChange(fn): () => void` (trả hàm huỷ đăng ký), `tryMove(dir): Move|null`, `tryUndo(): Move|null`, `tryRedo(): Move|null`, `restart(): void`

- [ ] **Step 1: Viết test cho `moveHistory.js`**

Tạo `web/tests/moveHistory.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MoveHistory } from '../src/core/moveHistory.js';

const fakeMove = (id) => ({ id });

test('lịch sử rỗng thì không undo cũng không redo được', () => {
  const history = new MoveHistory();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});

test('undo trả về nước cuối cùng và mở đường cho redo', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.record(fakeMove(2));

  assert.deepEqual(history.popForUndo(), fakeMove(2));
  assert.equal(history.canRedo, true);
  assert.deepEqual(history.popForRedo(), fakeMove(2));
  assert.equal(history.canRedo, false);
});

test('ghi nước mới thì xoá sạch nhánh redo', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.popForUndo();
  assert.equal(history.canRedo, true);

  history.record(fakeMove(2));
  assert.equal(history.canRedo, false);
});

test('clear xoá cả hai nhánh', () => {
  const history = new MoveHistory();
  history.record(fakeMove(1));
  history.popForUndo();
  history.record(fakeMove(2));

  history.clear();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/core/moveHistory.js`.

- [ ] **Step 3: Viết `web/src/core/moveHistory.js`**

```js
/** Hai stack: nước đã đi và nhánh đã undo. Đi nước mới thì xoá nhánh redo. */
export class MoveHistory {
  #done = [];
  #undone = [];

  get canUndo() { return this.#done.length > 0; }
  get canRedo() { return this.#undone.length > 0; }

  record(move) {
    this.#done.push(move);
    this.#undone.length = 0;
  }

  popForUndo() {
    const move = this.#done.pop();
    this.#undone.push(move);
    return move;
  }

  popForRedo() {
    const move = this.#undone.pop();
    this.#done.push(move);
    return move;
  }

  clear() {
    this.#done.length = 0;
    this.#undone.length = 0;
  }
}
```

- [ ] **Step 4: Viết test cho `gameSession.js`**

Tạo `web/tests/gameSession.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { makeLevel } from './helpers.mjs';

const level = () => makeLevel(['#######', '#@$ . #', '#######'], 'thử');

test('đi một nước thì tăng bộ đếm bước', () => {
  const session = new GameSession(level());
  assert.equal(session.tryMove(Direction.Right).push, true);
  assert.equal(session.moves, 1);
  assert.equal(session.pushes, 1);
});

test('nước bị chặn không tính vào bộ đếm và trả về null', () => {
  const session = new GameSession(level());
  assert.equal(session.tryMove(Direction.Left), null);
  assert.equal(session.moves, 0);
});

test('undo trả bộ đếm và bàn cờ về đúng trạng thái trước đó', () => {
  const session = new GameSession(level());
  session.tryMove(Direction.Right);

  assert.ok(session.tryUndo());
  assert.equal(session.moves, 0);
  assert.equal(session.pushes, 0);
  assert.deepEqual(session.board.player, { x: 1, y: 1 });
  assert.equal(session.board.hasBox(2, 1), true);
});

test('undo hết thì trùng khớp trạng thái đầu màn', () => {
  const session = new GameSession(level());
  const start = new GameSession(level());

  session.tryMove(Direction.Right);
  session.tryMove(Direction.Right);
  while (session.canUndo) session.tryUndo();

  assert.deepEqual(session.board.player, start.board.player);
  assert.deepEqual([...session.board.boxes].sort(), [...start.board.boxes].sort());
  assert.equal(session.moves, 0);
});

test('redo lặp lại đúng nước vừa undo', () => {
  const session = new GameSession(level());
  session.tryMove(Direction.Right);
  session.tryUndo();

  assert.ok(session.tryRedo());
  assert.equal(session.moves, 1);
  assert.deepEqual(session.board.player, { x: 2, y: 1 });
});

test('đi nước mới thì xoá nhánh redo', () => {
  const session = new GameSession(level());
  session.tryMove(Direction.Right);
  session.tryUndo();
  assert.equal(session.canRedo, true);

  session.tryMove(Direction.Right);
  assert.equal(session.canRedo, false);
});

test('restart dựng lại bàn cờ và xoá lịch sử', () => {
  const session = new GameSession(level());
  session.tryMove(Direction.Right);
  session.restart();

  assert.equal(session.moves, 0);
  assert.equal(session.canUndo, false);
  assert.deepEqual(session.board.player, { x: 1, y: 1 });
  assert.equal(session.board.hasBox(2, 1), true);
});

test('onChange báo mỗi lần trạng thái đổi và huỷ được', () => {
  const session = new GameSession(level());
  let count = 0;
  const off = session.onChange(() => { count++; });

  session.tryMove(Direction.Right);
  session.tryUndo();
  assert.equal(count, 2);

  off();
  session.tryMove(Direction.Right);
  assert.equal(count, 2);
});

test('nước bị chặn không phát sự kiện', () => {
  const session = new GameSession(level());
  let count = 0;
  session.onChange(() => { count++; });

  session.tryMove(Direction.Left);
  assert.equal(count, 0);
});
```

- [ ] **Step 5: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/core/gameSession.js`.

- [ ] **Step 6: Viết `web/src/core/gameSession.js`**

```js
import { Board } from './board.js';
import { MoveHistory } from './moveHistory.js';
import { resolve, apply, revert } from './moveResolver.js';

/** Gói board + lịch sử + bộ đếm cho một lượt chơi một màn. */
export class GameSession {
  #level;
  #history = new MoveHistory();
  #listeners = new Set();

  constructor(level) {
    this.#level = level;
    this.board = Board.fromLevel(level);
    this.moves = 0;
    this.pushes = 0;
  }

  get isSolved() { return this.board.isSolved; }
  get canUndo() { return this.#history.canUndo; }
  get canRedo() { return this.#history.canRedo; }
  get levelName() { return this.#level.name; }

  /** Trả về hàm huỷ đăng ký, để nơi gọi không phải giữ tham chiếu tới listener. */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    for (const listener of this.#listeners) listener();
  }

  /** Trả về nước đi đã chạy, hoặc null nếu bị chặn. */
  tryMove(dir) {
    const move = resolve(this.board, dir);
    if (move.blocked) return null;

    apply(this.board, move);
    this.#history.record(move);
    this.moves++;
    if (move.push) this.pushes++;

    this.#emit();
    return move;
  }

  tryUndo() {
    if (!this.#history.canUndo) return null;

    const move = this.#history.popForUndo();
    revert(this.board, move);
    this.moves--;
    if (move.push) this.pushes--;

    this.#emit();
    return move;
  }

  tryRedo() {
    if (!this.#history.canRedo) return null;

    const move = this.#history.popForRedo();
    apply(this.board, move);
    this.moves++;
    if (move.push) this.pushes++;

    this.#emit();
    return move;
  }

  restart() {
    this.board = Board.fromLevel(this.#level);
    this.#history.clear();
    this.moves = 0;
    this.pushes = 0;
    this.#emit();
  }
}
```

- [ ] **Step 7: Chạy test để chắc chắn nó xanh**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 39 test.

- [ ] **Step 8: Commit**

```bash
git add web/src/core/moveHistory.js web/src/core/gameSession.js web/tests/moveHistory.test.mjs web/tests/gameSession.test.mjs
git commit -m "Thêm lịch sử undo/redo và GameSession

onChange trả về hàm huỷ đăng ký để panel nào rời màn hình cũng tự gỡ được
listener, tránh giữ tham chiếu tới màn cũ."
```

---

### Task 5: Parser Microban

**Files:**
- Create: `web/src/levels/parseMicroban.js`
- Test: `web/tests/parseMicroban.test.mjs`

**Interfaces:**
- Consumes: `sokobanChars.js`
- Produces: `parseMicroban(text: string): { levels: Level[], errors: string[] }`, với `Level` là `{ name, width, height, rows }`

**Bối cảnh định dạng** (đã kiểm chứng trên `Assets/Levels/microban.txt`, 155 màn): các khối cách nhau bằng dòng trống; khối đầu tiên là header (`Title:` / `Description:` / `Author:` / `Email:` / `Website:`, `Description` trải nhiều dòng thụt lề) và **không phải màn chơi**; mỗi khối màn có các hàng lưới trước rồi dòng `Title: <n>` ở cuối; các hàng trong cùng một màn dài ngắn khác nhau nên phải pad.

- [ ] **Step 1: Viết test cho `parseMicroban.js`**

Tạo `web/tests/parseMicroban.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMicroban } from '../src/levels/parseMicroban.js';

test('đọc một màn với tên nằm sau lưới', () => {
  const { levels, errors } = parseMicroban([
    '#####',
    '#@$.#',
    '#####',
    'Title: 7',
  ].join('\n'));

  assert.deepEqual(errors, []);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].name, '7');
  assert.equal(levels[0].width, 5);
  assert.equal(levels[0].height, 3);
});

test('pad hàng ngắn cho bằng hàng dài nhất', () => {
  const { levels } = parseMicroban(['####', '#@$.###', '####'].join('\n'));

  assert.equal(levels[0].width, 7);
  assert.deepEqual(levels[0].rows, ['####   ', '#@$.###', '####   ']);
});

test('bỏ qua khối header vì nó không có hàng lưới nào', () => {
  const { levels, errors } = parseMicroban([
    'Title: Microban',
    'Description: mấy màn nhỏ',
    '             viết tiếp ở dòng dưới',
    'Author: David W Skinner',
    '',
    '#####',
    '#@$.#',
    '#####',
    'Title: 1',
  ].join('\n'));

  assert.deepEqual(errors, []);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].name, '1');
});

test('đọc được cả 7 ký tự', () => {
  // 3 hộp ($ $ *) và 3 đích (. * +) — phải cân nhau, không thì parser báo lỗi.
  const { levels, errors } = parseMicroban(['#+*$$.#', 'Title: x'].join('\n'));

  assert.deepEqual(errors, []);
  assert.deepEqual(levels[0].rows, ['#+*$$.#']);
});

test('nhiều màn cách nhau bằng dòng trống', () => {
  const { levels } = parseMicroban([
    '#####', '#@$.#', '#####', 'Title: 1',
    '',
    '#####', '#@$.#', '#####', 'Title: 2',
  ].join('\n'));

  assert.equal(levels.length, 2);
  assert.deepEqual(levels.map((l) => l.name), ['1', '2']);
});

test('màn không đúng một người chơi thì báo lỗi kèm số dòng và bị bỏ qua', () => {
  const { levels, errors } = parseMicroban([
    '',
    '#####',
    '#@$@#',
    '#####',
  ].join('\n'));

  assert.equal(levels.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Dòng 2/);
  assert.match(errors[0], /2/);
});

test('số hộp khác số đích thì báo lỗi', () => {
  const { errors } = parseMicroban(['#####', '#@$ #', '#####'].join('\n'));

  assert.equal(errors.length, 1);
  assert.match(errors[0], /1 hộp/);
});

test('một màn hỏng không làm hỏng các màn còn lại', () => {
  const { levels, errors } = parseMicroban([
    '#####', '#@$@#', '#####',
    '',
    '#####', '#@$.#', '#####', 'Title: tốt',
  ].join('\n'));

  assert.equal(errors.length, 1);
  assert.equal(levels.length, 1);
  assert.equal(levels[0].name, 'tốt');
});

test('màn không có tên thì tự đặt theo thứ tự', () => {
  const { levels } = parseMicroban(['#####', '#@$.#', '#####'].join('\n'));
  assert.equal(levels[0].name, 'Level 1');
});

test('chuỗi rỗng cho ra kết quả rỗng, không phải lỗi', () => {
  assert.deepEqual(parseMicroban(''), { levels: [], errors: [] });
});

test('xuống dòng kiểu Windows đọc được như thường', () => {
  const { levels } = parseMicroban('#####\r\n#@$.#\r\n#####\r\nTitle: 1');
  assert.equal(levels.length, 1);
  assert.equal(levels[0].width, 5);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/levels/parseMicroban.js`.

- [ ] **Step 3: Viết `web/src/levels/parseMicroban.js`**

```js
import { isGrid, isContent, countPieces } from './sokobanChars.js';

const TITLE_PREFIX = 'Title:';

/**
 * Đọc file Microban dạng text. Trả về cả màn đọc được lẫn danh sách lỗi:
 * một màn hỏng không được làm hỏng cả bộ.
 */
export function parseMicroban(text) {
  const result = { levels: [], errors: [] };
  if (!text) return result;

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    const blockStartLine = i + 1;         // số dòng 1-based cho thông báo lỗi
    const block = [];
    while (i < lines.length && lines[i].trim() !== '') block.push(lines[i++]);

    tryAddLevel(block, blockStartLine, result);
  }

  return result;
}

function tryAddLevel(block, blockStartLine, result) {
  const rows = [];
  let name = null;

  for (const line of block) {
    if (line.startsWith(TITLE_PREFIX)) {
      name = line.slice(TITLE_PREFIX.length).trim();
      continue;
    }
    if (isGridLine(line)) rows.push(line);
  }

  // Khối header không có hàng lưới nào — bỏ qua, đây không phải lỗi.
  if (rows.length === 0) return;

  const { players, boxes, goals } = countPieces(rows);

  if (players !== 1) {
    result.errors.push(`Dòng ${blockStartLine}: phải có đúng 1 người chơi, đang có ${players}`);
    return;
  }
  if (boxes === 0) {
    result.errors.push(`Dòng ${blockStartLine}: màn không có hộp nào`);
    return;
  }
  if (boxes !== goals) {
    result.errors.push(`Dòng ${blockStartLine}: ${boxes} hộp nhưng ${goals} đích`);
    return;
  }

  const width = Math.max(...rows.map((r) => r.length));

  result.levels.push({
    name: name || `Level ${result.levels.length + 1}`,
    width,
    height: rows.length,
    rows: rows.map((r) => r.padEnd(width)),
  });
}

/** Hàng lưới = chỉ gồm 7 ký tự hợp lệ và có ít nhất một ký tự khác dấu cách. */
function isGridLine(line) {
  let hasContent = false;
  for (const c of line) {
    if (!isGrid(c)) return false;
    if (isContent(c)) hasContent = true;
  }
  return hasContent;
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 50 test.

- [ ] **Step 5: Commit**

```bash
git add web/src/levels/parseMicroban.js web/tests/parseMicroban.test.mjs
git commit -m "Thêm parser Microban

Khối header bị bỏ qua bằng cách hỏi \"có hàng lưới nào không\" thay vì nhận
diện theo từ khoá, nên bộ màn khác có header khác vẫn đọc được."
```

---

### Task 6: `levelValidator`

**Files:**
- Create: `web/src/levels/levelValidator.js`
- Test: `web/tests/levelValidator.test.mjs`

**Interfaces:**
- Consumes: `sokobanChars.js`
- Produces: `validateLevel(level: Level): string[]` — mảng thông báo lỗi tiếng Việt, rỗng nghĩa là hợp lệ

- [ ] **Step 1: Viết test cho `levelValidator.js`**

Tạo `web/tests/levelValidator.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLevel } from '../src/levels/levelValidator.js';
import { makeLevel } from './helpers.mjs';

test('màn đúng chuẩn không có lỗi nào', () => {
  assert.deepEqual(validateLevel(makeLevel(['#####', '#@$.#', '#####'])), []);
});

test('màn rỗng bị báo lỗi', () => {
  assert.equal(validateLevel(makeLevel([])).length, 1);
  assert.match(validateLevel({ name: 'x', width: 0, height: 0, rows: [] })[0], /rỗng/);
});

test('thiếu hoặc thừa người chơi đều bị bắt', () => {
  assert.match(validateLevel(makeLevel(['#####', '# $.#', '#####']))[0], /một người chơi/);
  assert.match(validateLevel(makeLevel(['######', '#@$.@#', '######']))[0], /một người chơi/);
});

test('số hộp khác số đích bị bắt', () => {
  const issues = validateLevel(makeLevel(['######', '#@$$.#', '######']));
  assert.equal(issues.length, 1);
  assert.match(issues[0], /Số hộp/);
});

test('màn không có hộp nào bị bắt', () => {
  assert.match(validateLevel(makeLevel(['#####', '#@  #', '#####']))[0], /không có hộp/);
});

test('vùng chơi hở bị bắt', () => {
  // Thiếu tường ở cạnh phải nên người chơi đi ra ngoài lưới được.
  const issues = validateLevel(makeLevel(['#####', '#@$. ', '#####']));
  assert.ok(issues.some((m) => /chưa kín/.test(m)));
});

test('vùng chơi kín thì không báo hở', () => {
  const issues = validateLevel(makeLevel(['#####', '#@$.#', '#####']));
  assert.equal(issues.some((m) => /chưa kín/.test(m)), false);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/levels/levelValidator.js`.

- [ ] **Step 3: Viết `web/src/levels/levelValidator.js`**

```js
import { WALL, countPieces } from './sokobanChars.js';

/**
 * Kiểm tra cấu trúc một màn. KHÔNG kiểm tra màn có giải được hay không —
 * viết solver Sokoban là bài toán riêng, nằm ngoài phạm vi.
 */
export function validateLevel(level) {
  if (!level || !level.rows || level.rows.length === 0) return ['Màn rỗng'];

  const issues = [];
  const { players, boxes, goals, playerPos } = countPieces(level.rows);

  if (players !== 1) issues.push(`Phải có đúng một người chơi, đang có ${players}`);
  if (boxes === 0) issues.push('Màn không có hộp nào');
  else if (boxes !== goals) issues.push(`Số hộp (${boxes}) khác số đích (${goals})`);

  if (players === 1 && !isEnclosed(level, playerPos)) {
    issues.push('Vùng chơi chưa kín — người chơi đi ra ngoài lưới được');
  }

  return issues;
}

/** Loang từ chỗ người chơi; chạm được ra ngoài lưới nghĩa là tường chưa bao kín. */
function isEnclosed(level, start) {
  const height = level.rows.length;
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length > 0) {
    const p = queue.shift();
    for (const [dx, dy] of deltas) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (n.y < 0 || n.y >= height) return false;

      const row = level.rows[n.y];
      if (n.x < 0 || n.x >= row.length) return false;

      const key = `${n.x},${n.y}`;
      if (row[n.x] === WALL || seen.has(key)) continue;
      seen.add(key);
      queue.push(n);
    }
  }

  return true;
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 57 test.

- [ ] **Step 5: Commit**

```bash
git add web/src/levels/levelValidator.js web/tests/levelValidator.test.mjs
git commit -m "Thêm bộ kiểm tra cấu trúc màn

Kiểm tra tường bao kín bằng cách loang từ người chơi, vì màn hở chỉ lộ ra
khi chơi tới nơi chứ không nhìn lưới mà thấy ngay được."
```

---

### Task 7: Sinh `microban.json` và test hồi quy toàn bộ 155 màn

**Files:**
- Create: `web/tools/import-microban.mjs`
- Create: `web/src/levels/microban.json` (sinh ra bằng script ở bước 2)
- Test: `web/tests/microban.regression.test.mjs`

**Interfaces:**
- Consumes: `parseMicroban.js`, `levelValidator.js`, `gameSession.js`, `direction.js`
- Produces: file `web/src/levels/microban.json` với hình dạng `{ "collectionName": "Microban", "levels": Level[] }`

**Lời giải dùng cho test** — lấy bằng cách chạy solver BFS trên chính `microban.txt`, đã xác minh đưa bàn cờ về trạng thái thắng. Chữ hoa là nước đẩy, chữ thường là nước đi; test đọc không phân biệt hoa thường.

| Màn | Lời giải | Số nước |
|---|---|---|
| 1 | `dlUrrrdLullddrUluRuulDrddrruLdlUU` | 33 |
| 2 | `rddLruulDuullddR` | 16 |
| 3 | `ruuLLLulDrrrrddlUruLLLddllluurRDrdLuuurDD` | 41 |
| 4 | `ullDLdRuurrdLLrrddlUruL` | 23 |
| 5 | `LuRllDrdRdrruuLLdlUddlluR` | 25 |

- [ ] **Step 1: Viết `web/tools/import-microban.mjs`**

```js
// Sinh web/src/levels/microban.json từ file text gốc trong project Unity.
// Chạy tay khi đổi bộ màn:  node tools/import-microban.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseMicroban } from '../src/levels/parseMicroban.js';
import { validateLevel } from '../src/levels/levelValidator.js';

const SOURCE = fileURLToPath(new URL('../../Assets/Levels/microban.txt', import.meta.url));
const OUTPUT = fileURLToPath(new URL('../src/levels/microban.json', import.meta.url));

const { levels, errors } = parseMicroban(readFileSync(SOURCE, 'utf8'));

for (const error of errors) console.error(`Lỗi parse: ${error}`);

let invalid = 0;
levels.forEach((level, index) => {
  const issues = validateLevel(level);
  for (const issue of issues) {
    console.error(`Màn ${index} ("${level.name}"): ${issue}`);
    invalid++;
  }
});

if (errors.length > 0 || invalid > 0) {
  // Ghi ra một bộ màn có màn hỏng thì lỗi sẽ nổ lúc chơi, xa chỗ gây ra nó.
  console.error(`\nDừng lại: ${errors.length} lỗi parse, ${invalid} màn không hợp lệ.`);
  process.exit(1);
}

writeFileSync(OUTPUT, `${JSON.stringify({ collectionName: 'Microban', levels }, null, 1)}\n`, 'utf8');
console.log(`Đã ghi ${levels.length} màn vào ${OUTPUT}`);
```

- [ ] **Step 2: Chạy script để sinh `microban.json`**

```bash
cd web && node tools/import-microban.mjs
```

Kỳ vọng: in `Đã ghi 155 màn vào ...`, không có dòng lỗi nào, và file `web/src/levels/microban.json` xuất hiện.

- [ ] **Step 3: Viết test hồi quy**

Tạo `web/tests/microban.regression.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Direction } from '../src/core/direction.js';
import { GameSession } from '../src/core/gameSession.js';
import { validateLevel } from '../src/levels/levelValidator.js';

const collection = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/levels/microban.json', import.meta.url)), 'utf8'),
);

// Chữ hoa là nước đẩy, chữ thường là nước đi — quy ước LURD của cộng đồng Sokoban.
const LETTER_TO_DIR = {
  u: Direction.Up, d: Direction.Down, l: Direction.Left, r: Direction.Right,
};

const SOLUTIONS = {
  0: 'dlUrrrdLullddrUluRuulDrddrruLdlUU',
  1: 'rddLruulDuullddR',
  2: 'ruuLLLulDrrrrddlUruLLLddllluurRDrdLuuurDD',
  3: 'ullDLdRuurrdLLrrddlUruL',
  4: 'LuRllDrdRdrruuLLdlUddlluR',
};

test('bộ màn có đúng 155 màn', () => {
  assert.equal(collection.collectionName, 'Microban');
  assert.equal(collection.levels.length, 155);
});

test('mọi màn đều hợp lệ về cấu trúc', () => {
  const broken = collection.levels
    .map((level, index) => ({ index, name: level.name, issues: validateLevel(level) }))
    .filter((r) => r.issues.length > 0);

  assert.deepEqual(broken, []);
});

test('mọi màn đều có hàng dài bằng nhau và bằng width', () => {
  for (const level of collection.levels) {
    assert.equal(level.rows.length, level.height, `màn ${level.name} sai height`);
    for (const row of level.rows) {
      assert.equal(row.length, level.width, `màn ${level.name} có hàng lệch width`);
    }
  }
});

for (const [index, solution] of Object.entries(SOLUTIONS)) {
  const level = collection.levels[Number(index)];

  test(`lời giải của màn "${level.name}" đưa bàn cờ về trạng thái thắng`, () => {
    const session = new GameSession(level);

    for (const letter of solution) {
      const dir = LETTER_TO_DIR[letter.toLowerCase()];
      assert.ok(dir, `ký tự lạ trong lời giải: ${letter}`);
      assert.ok(session.tryMove(dir), `nước ${letter} bị chặn ở màn ${level.name}`);
    }

    assert.equal(session.isSolved, true);
    assert.equal(session.moves, solution.length);
  });
}
```

- [ ] **Step 4: Chạy test**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 65 test (57 cũ + 3 hồi quy + 5 lời giải).

- [ ] **Step 5: Commit**

```bash
git add web/tools/import-microban.mjs web/src/levels/microban.json web/tests/microban.regression.test.mjs
git commit -m "Sinh microban.json và khoá lại bằng test hồi quy

Import chạy tay rồi commit kết quả: parse 155 màn mỗi lần mở game là việc
thừa, và JSON đã commit thì diff thấy ngay khi bộ màn đổi."
```

---

### Task 8: Copy asset, CSS tile, và vẽ được một màn tĩnh

**Files:**
- Create: `web/assets/art/` (8 file PNG, copy)
- Create: `web/assets/audio/` (6 file âm thanh + `License.txt`, copy)
- Create: `web/index.html`
- Create: `web/styles/base.css`
- Create: `web/styles/board.css`
- Create: `web/src/view/boardRenderer.js`
- Create: `web/src/main.js`

**Interfaces:**
- Consumes: `board.js` (`Board`, `CellType`, `boxKey`), `direction.js`
- Produces:
  - `class BoardRenderer`: `constructor(rootEl: HTMLElement)`, `build(board: Board): void`, `boxElAt(x, y): HTMLElement|null`, `rekeyBox(fromX, fromY, toX, toY): void`, `refreshBoxLook(board: Board): void`, `setPlayerFacing(dir: string): void`, `fitCellSize(board: Board): void`, `playerEl: HTMLElement`
  - CSS: `.board`, `.board__statics`, `.board__actors`, `.tile`, `.tile--wall`, `.tile--floor-a`, `.tile--floor-b`, `.tile--goal`, `.actor`, `.actor--player`, `.actor--box`, `.actor__sprite`, `.actor__mark`, `.board--no-anim`, biến `--cell` / `--cols` / `--rows`

- [ ] **Step 1: Copy asset sang `web/assets/`**

```bash
mkdir -p web/assets/art web/assets/audio
cp Assets/Art/Modern/box.png Assets/Art/Modern/box_on_goal.png \
   Assets/Art/Modern/player_up.png Assets/Art/Modern/player_down.png \
   Assets/Art/Modern/player_left.png Assets/Art/Modern/player_right.png \
   Assets/Art/Markers/mark_o.png Assets/Art/Markers/mark_x.png \
   web/assets/art/
cp Assets/Audio/step.ogg Assets/Audio/push.ogg Assets/Audio/box_on_goal.ogg \
   Assets/Audio/win.ogg Assets/Audio/undo.ogg Assets/Audio/music_loop.mp3 \
   Assets/Audio/License.txt \
   web/assets/audio/
ls web/assets/art web/assets/audio
```

Kỳ vọng: `web/assets/art` có 8 file, `web/assets/audio` có 7 file. **Không** copy `goal.png` — đó là art cũ, ô đích dùng `mark_o.png`.

- [ ] **Step 2: Viết `web/styles/base.css`**

```css
:root {
  --bg: #12161c;
  --panel: #1a212a;
  --panel-line: rgba(255, 255, 255, 0.07);
  --text: #e6ebf2;
  --text-dim: rgba(230, 235, 242, 0.65);
  --accent: #d53b35;

  --floor-a-top: #262d38;
  --floor-a-bottom: #1f242d;
  --floor-b-top: #2c3441;
  --floor-b-bottom: #232a34;
  --wall-top: #5e6878;
  --wall-bottom: #414956;

  --cell-min: 20px;
  --cell-max: 64px;
  --move-duration: 120ms;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 system-ui, "Segoe UI", sans-serif;
}

img { display: block; }
```

- [ ] **Step 3: Viết `web/styles/board.css`**

```css
.board {
  --cell: 44px;
  position: relative;
  width: calc(var(--cols) * var(--cell));
  height: calc(var(--rows) * var(--cell));
}

.board__statics {
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--cell));
  grid-auto-rows: var(--cell);
}

.tile {
  width: var(--cell);
  height: var(--cell);
  position: relative;
}

.tile--floor-a { background: linear-gradient(180deg, var(--floor-a-top), var(--floor-a-bottom)); }
.tile--floor-b { background: linear-gradient(180deg, var(--floor-b-top), var(--floor-b-bottom)); }

/* Tường vẽ bằng CSS: hai lớp kẻ mạch vữa chồng lên nền dốc. */
.tile--wall {
  background:
    repeating-linear-gradient(0deg, transparent 0 calc(var(--cell) / 4),
                              rgba(0, 0, 0, 0.30) calc(var(--cell) / 4) calc(var(--cell) / 3.4)),
    repeating-linear-gradient(90deg, transparent 0 calc(var(--cell) / 2.4),
                              rgba(0, 0, 0, 0.30) calc(var(--cell) / 2.4) calc(var(--cell) / 2.2)),
    linear-gradient(180deg, var(--wall-top), var(--wall-bottom));
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.14), inset 0 -3px 0 rgba(0, 0, 0, 0.35);
}

/* Ô đích là sprite nền trong suốt nằm trên lớp nền. */
.tile--goal > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/*
 * Khung chứa bàn cờ. Phải có chiều cao THẬT, không phụ thuộc vào bàn cờ: nếu để
 * nó co theo `.board` (cao `rows × --cell`) thì phép đo trong `fitCellSize` thành
 * vòng tự tham chiếu — `chiều cao khung / số hàng` rút gọn về đúng cỡ ô đang có,
 * nên ô không bao giờ lớn ra được.
 */
.stage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.board__actors {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.actor {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--cell);
  height: var(--cell);
  transition: transform var(--move-duration) linear;
  will-change: transform;
}

.actor__sprite,
.actor__mark {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.actor__mark[hidden] { display: none; }

/* Bật khi load màn hoặc restart, để actor không bay từ vị trí màn cũ sang. */
.board--no-anim .actor { transition: none; }

/* Ô thiếu sprite: hiện hồng chói thay vì im lặng bỏ trống. */
.tile--missing,
.actor--missing { background: #ff00ff; }
```

- [ ] **Step 4: Viết `web/index.html`**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sokoban</title>
  <link rel="stylesheet" href="styles/base.css">
  <link rel="stylesheet" href="styles/board.css">
</head>
<body>
  <main class="stage" id="stage">
    <div class="board" id="board"></div>
  </main>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Viết `web/src/view/boardRenderer.js`**

```js
import { CellType, boxKey } from '../core/board.js';
import { Direction } from '../core/direction.js';

const ART = 'assets/art';

const PLAYER_SPRITE = {
  [Direction.Up]: `${ART}/player_up.png`,
  [Direction.Down]: `${ART}/player_down.png`,
  [Direction.Left]: `${ART}/player_left.png`,
  [Direction.Right]: `${ART}/player_right.png`,
};

const CELL_MIN = 20;
const CELL_MAX = 64;

/**
 * Dựng phần tĩnh của màn một lần rồi để yên, còn người chơi và hộp là phần tử
 * absolute di chuyển bằng transform. Chính là kiểu Tilemap tĩnh + GameObject
 * động của bản Unity.
 */
export class BoardRenderer {
  #root;
  #statics;
  #actors;
  #boxes = new Map();   // "x,y" -> phần tử hộp
  #cell = 44;

  constructor(rootEl) {
    this.#root = rootEl;
    this.playerEl = null;
  }

  build(board) {
    this.#root.textContent = '';
    this.#boxes.clear();

    this.#root.style.setProperty('--cols', String(board.width));
    this.#root.style.setProperty('--rows', String(board.height));

    this.#statics = document.createElement('div');
    this.#statics.className = 'board__statics';
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        this.#statics.append(this.#makeTile(board, x, y));
      }
    }

    this.#actors = document.createElement('div');
    this.#actors.className = 'board__actors';

    for (const key of board.boxes) {
      const [x, y] = key.split(',').map(Number);
      const el = this.#makeBox();
      this.#place(el, x, y);
      this.#boxes.set(key, el);
      this.#actors.append(el);
    }

    this.playerEl = this.#makePlayer();
    this.#place(this.playerEl, board.player.x, board.player.y);
    this.#actors.append(this.playerEl);

    this.#root.append(this.#statics, this.#actors);
    this.refreshBoxLook(board);
  }

  /** Kích thước ô theo chỗ trống còn lại, kẹp trong 20–64px. */
  fitCellSize(board) {
    const stage = this.#root.parentElement ?? document.body;

    // Đo content box, không dùng getBoundingClientRect: rect gồm cả padding nên
    // cỡ ô bị tính vượt và bàn cờ tràn qua lề. clientWidth/Height là padding box,
    // trừ padding ra thì còn đúng chỗ vẽ được.
    const style = getComputedStyle(stage);
    const availableWidth = stage.clientWidth
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = stage.clientHeight
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    const byWidth = availableWidth / board.width;
    const byHeight = availableHeight / board.height;

    this.#cell = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(Math.min(byWidth, byHeight))));
    this.#root.style.setProperty('--cell', `${this.#cell}px`);

    // Transform tính bằng px nên mọi actor phải được đặt lại sau khi đổi cỡ ô.
    for (const [key, el] of this.#boxes) {
      const [x, y] = key.split(',').map(Number);
      this.#place(el, x, y);
    }
    if (this.playerEl) this.#place(this.playerEl, board.player.x, board.player.y);
  }

  get cellSize() { return this.#cell; }

  boxElAt(x, y) {
    return this.#boxes.get(boxKey(x, y)) ?? null;
  }

  rekeyBox(fromX, fromY, toX, toY) {
    const el = this.#boxes.get(boxKey(fromX, fromY));
    if (!el) return;
    this.#boxes.delete(boxKey(fromX, fromY));
    this.#boxes.set(boxKey(toX, toY), el);
  }

  /** Hộp trên đích đổi sprite và tắt dấu X. */
  refreshBoxLook(board) {
    for (const [key, el] of this.#boxes) {
      const [x, y] = key.split(',').map(Number);
      const onGoal = board.cellAt(x, y) === CellType.Goal;
      el.querySelector('.actor__sprite').src = onGoal
        ? `${ART}/box_on_goal.png`
        : `${ART}/box.png`;
      el.querySelector('.actor__mark').hidden = onGoal;
    }
  }

  setPlayerFacing(dir) {
    const src = PLAYER_SPRITE[dir];
    if (src) this.playerEl.querySelector('.actor__sprite').src = src;
  }

  /** Đặt vị trí tức thì, không animation. */
  placeActor(el, x, y) {
    this.#place(el, x, y);
  }

  #place(el, x, y) {
    el.style.transform = `translate(${x * this.#cell}px, ${y * this.#cell}px)`;
  }

  #makeTile(board, x, y) {
    const cell = board.cellAt(x, y);
    const tile = document.createElement('i');

    if (cell === CellType.Wall) {
      tile.className = 'tile tile--wall';
      return tile;
    }

    tile.className = `tile tile--floor-${(x + y) % 2 === 0 ? 'a' : 'b'}`;
    if (cell === CellType.Goal) {
      tile.classList.add('tile--goal');
      tile.append(this.#makeImg(`${ART}/mark_o.png`, 'tile__sprite', 'tile--missing'));
    }
    return tile;
  }

  #makeBox() {
    const el = document.createElement('div');
    el.className = 'actor actor--box';
    el.append(this.#makeImg(`${ART}/box.png`, 'actor__sprite', 'actor--missing'));
    el.append(this.#makeImg(`${ART}/mark_x.png`, 'actor__mark', 'actor--missing'));
    return el;
  }

  #makePlayer() {
    const el = document.createElement('div');
    el.className = 'actor actor--player';
    el.append(this.#makeImg(PLAYER_SPRITE[Direction.Down], 'actor__sprite', 'actor--missing'));
    return el;
  }

  #makeImg(src, className, missingClass) {
    const img = document.createElement('img');
    img.className = className;
    img.alt = '';
    img.src = src;
    // Thiếu file art thì hiện ô hồng chói kèm lỗi, không im lặng bỏ trống.
    img.addEventListener('error', () => {
      img.parentElement?.classList.add(missingClass);
      console.error(`BoardRenderer: không tải được sprite ${src}`);
    });
    return img;
  }
}
```

- [ ] **Step 6: Viết `web/src/main.js` tạm để xem màn đầu tiên**

```js
import { Board } from './core/board.js';
import { BoardRenderer } from './view/boardRenderer.js';

const response = await fetch('src/levels/microban.json');
if (!response.ok) throw new Error(`Không tải được bộ màn: HTTP ${response.status}`);
const collection = await response.json();

const renderer = new BoardRenderer(document.getElementById('board'));
const board = Board.fromLevel(collection.levels[0]);

renderer.build(board);
renderer.fitCellSize(board);
```

Thứ tự bắt buộc là `build` rồi mới `fitCellSize`: `fitCellSize` cần biết kích thước màn để tính `--cell`, và nó tự đặt lại transform của mọi actor sau khi đổi cỡ ô.

- [ ] **Step 7: Mở trình duyệt và kiểm bằng mắt**

```bash
npx --yes serve web
```

Mở địa chỉ mà `serve` in ra. Kỳ vọng thấy màn Microban 1: khung tường xám có kẻ mạch, nền hai tông xen kẽ, một vòng tròn đỏ (ô đích) ở phía trên, hai hộp — **một hộp đã trên đích không có dấu X, một hộp chưa vào đích có dấu X** — và người chơi nhìn chính diện. Console không có lỗi.

- [ ] **Step 8: Commit**

```bash
git add web/assets web/index.html web/styles web/src/view/boardRenderer.js web/src/main.js
git commit -m "Vẽ được bàn cờ: nền và tường bằng CSS, actor bằng sprite

Nền và tường lặp lại nhiều nhất nên để CSS lo — luôn nét ở mọi cỡ ô và đổi
tông chỉ cần sửa một biến. Ô đích dùng mark_o.png theo art mới, không phải
goal.png cũ."
```

---

### Task 9: Đi, đẩy, animation

**Files:**
- Create: `web/src/view/moveAnimator.js`
- Create: `web/src/input/inputRouter.js`
- Create: `web/src/view/levelPlayer.js`
- Modify: `web/src/main.js` (thay toàn bộ nội dung)

**Interfaces:**
- Consumes: `boardRenderer.js`, `gameSession.js`, `direction.js`
- Produces:
  - `class MoveAnimator`: `constructor(renderer, rootEl)`, `get isBusy(): boolean`, `play(move, { reverse = false }): Promise<void>`, `snap(board): void`
  - `Command`: object đông cứng `{ Up, Down, Left, Right, Undo, Redo, Restart, Exit }`, giá trị là chuỗi trùng tên khoá
  - `class InputRouter`: `constructor(target = window)`, `attach(): void`, `detach(): void`, `onCommand(fn): () => void`, `bindButton(el, command): void`, `get heldDirection(): string|null`
  - `class LevelPlayer`: `constructor({ session, renderer, animator, router, hooks })` với `hooks` là `{ onSolved?, onExit?, onSound? }`; `handle(command): void`; `start(): void`. Cần `router` để hỏi `heldDirection` sau mỗi animation.

- [ ] **Step 1: Viết `web/src/view/moveAnimator.js`**

```js
const FALLBACK_MS = 400;

/**
 * Chạy animation cho một nước đi bằng cách đổi transform rồi đợi transitionend.
 * Có timeout dự phòng vì transitionend không nổ khi tab bị ẩn hoặc khi giá trị
 * transform không thực sự đổi — thiếu nó là kẹt vĩnh viễn.
 */
export class MoveAnimator {
  #renderer;
  #root;
  #busy = false;

  constructor(renderer, rootEl) {
    this.#renderer = renderer;
    this.#root = rootEl;
  }

  get isBusy() { return this.#busy; }

  async play(move, { reverse = false } = {}) {
    this.#busy = true;
    try {
      const playerTo = reverse ? move.from : move.to;

      if (move.push) {
        const boxFrom = reverse ? move.boxTo : move.boxFrom;
        const boxTo = reverse ? move.boxFrom : move.boxTo;
        const boxEl = this.#renderer.boxElAt(boxFrom.x, boxFrom.y);
        if (boxEl) {
          this.#renderer.rekeyBox(boxFrom.x, boxFrom.y, boxTo.x, boxTo.y);
          this.#renderer.placeActor(boxEl, boxTo.x, boxTo.y);
        }
      }

      this.#renderer.placeActor(this.#renderer.playerEl, playerTo.x, playerTo.y);
      await this.#waitForEnd(this.#renderer.playerEl);
    } finally {
      this.#busy = false;
    }
  }

  /** Đặt lại mọi actor về đúng ô, không animation — dùng khi load màn và restart. */
  snap(board) {
    this.#root.classList.add('board--no-anim');
    this.#renderer.build(board);
    // Ép trình duyệt tính lại layout trước khi bỏ class, nếu không transition
    // sẽ bắt được lần đổi transform này và actor vẫn bay.
    void this.#root.offsetHeight;
    this.#root.classList.remove('board--no-anim');
  }

  #waitForEnd(el) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener('transitionend', finish);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, FALLBACK_MS);
      el.addEventListener('transitionend', finish);
    });
  }
}
```

- [ ] **Step 2: Viết `web/src/input/inputRouter.js`**

```js
import { Direction } from '../core/direction.js';

export const Command = Object.freeze({
  Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right',
  Undo: 'Undo', Redo: 'Redo', Restart: 'Restart', Exit: 'Exit',
});

const KEY_TO_COMMAND = {
  ArrowUp: Command.Up, KeyW: Command.Up,
  ArrowDown: Command.Down, KeyS: Command.Down,
  ArrowLeft: Command.Left, KeyA: Command.Left,
  ArrowRight: Command.Right, KeyD: Command.Right,
  KeyU: Command.Undo,
  KeyY: Command.Redo,
  KeyR: Command.Restart,
  Escape: Command.Exit,
};

const COMMAND_TO_DIRECTION = {
  [Command.Up]: Direction.Up,
  [Command.Down]: Direction.Down,
  [Command.Left]: Direction.Left,
  [Command.Right]: Direction.Right,
};

export function commandToDirection(command) {
  return COMMAND_TO_DIRECTION[command] ?? null;
}

/** Gom bàn phím và nút bấm thành một luồng lệnh duy nhất. */
export class InputRouter {
  #target;
  #listeners = new Set();
  #held = [];           // các phím hướng đang giữ, mới nhất ở cuối

  constructor(target = window) {
    this.#target = target;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
  }

  attach() {
    this.#target.addEventListener('keydown', this.onKeyDown);
    this.#target.addEventListener('keyup', this.onKeyUp);
    this.#target.addEventListener('blur', this.onBlur);
  }

  detach() {
    this.#target.removeEventListener('keydown', this.onKeyDown);
    this.#target.removeEventListener('keyup', this.onKeyUp);
    this.#target.removeEventListener('blur', this.onBlur);
  }

  onCommand(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  bindButton(el, command) {
    el.addEventListener('click', () => this.#emit(command));
  }

  /**
   * Hướng của phím đang giữ, mới nhất thắng. LevelPlayer hỏi cái này sau mỗi
   * animation thay vì dựa vào auto-repeat của hệ điều hành — auto-repeat trễ
   * khoảng 500ms ở nhịp đầu nên cầm phím sẽ khựng.
   */
  get heldDirection() {
    for (let i = this.#held.length - 1; i >= 0; i--) {
      const dir = commandToDirection(this.#held[i]);
      if (dir) return dir;
    }
    return null;
  }

  onKeyDown(event) {
    const command = KEY_TO_COMMAND[event.code];
    if (!command) return;

    event.preventDefault();   // mũi tên không được cuộn trang

    if (commandToDirection(command)) {
      if (event.repeat) return;                 // nhịp lặp của OS bỏ qua, đã tự lo
      if (!this.#held.includes(command)) this.#held.push(command);
    }
    this.#emit(command);
  }

  onKeyUp(event) {
    const command = KEY_TO_COMMAND[event.code];
    if (!command) return;
    this.#held = this.#held.filter((c) => c !== command);
  }

  /** Mất focus thì coi như buông hết phím, không thì người chơi sẽ đi mãi. */
  onBlur() {
    this.#held = [];
  }

  #emit(command) {
    for (const listener of this.#listeners) listener(command);
  }
}
```

- [ ] **Step 3: Viết `web/src/view/levelPlayer.js`**

```js
import { CellType } from '../core/board.js';
import { commandToDirection, Command } from '../input/inputRouter.js';

/**
 * Vòng lặp chơi một màn: nhận lệnh, gọi session, chạy animation. Trong lúc
 * animation chạy thì đệm tối đa 1 lệnh — đệm nhiều hơn thì thả phím ra rồi
 * nhân vật vẫn đi thêm mấy bước.
 */
export class LevelPlayer {
  #session;
  #renderer;
  #animator;
  #router;
  #hooks;
  #buffered = null;

  constructor({ session, renderer, animator, router, hooks = {} }) {
    this.#session = session;
    this.#renderer = renderer;
    this.#animator = animator;
    this.#router = router;
    this.#hooks = hooks;
  }

  start() {
    this.#animator.snap(this.#session.board);
    this.#renderer.fitCellSize(this.#session.board);
  }

  handle(command) {
    if (command === Command.Exit) {
      this.#hooks.onExit?.();
      return;
    }

    if (this.#animator.isBusy) {
      this.#buffered = command;
      return;
    }
    void this.#loop(command);
  }

  /**
   * Vòng lặp thay vì đệ quy: giữ phím cả phút thì bản đệ quy chồng thêm một
   * khung stack mỗi bước và không bao giờ nhả ra.
   */
  async #loop(first) {
    let command = first;

    while (command) {
      const acted = await this.#runOne(command);

      const buffered = this.#buffered;
      this.#buffered = null;

      // Nước bị chặn thì KHÔNG tự đi tiếp theo phím đang giữ. Người chơi đang
      // ấn vào tường, mà #runOne lúc đó không await gì cả — lặp lại sẽ thành
      // vòng lặp chặt làm treo tab.
      const next = buffered ?? (acted ? this.#router.heldDirection : null);
      command = this.#session.isSolved ? null : next;
    }
  }

  /** Trả về true nếu có gì đó thực sự chạy (và đã chờ animation xong). */
  async #runOne(command) {
    const dir = commandToDirection(command);

    if (dir) return this.#step(dir);
    if (command === Command.Undo) return this.#stepHistory(this.#session.tryUndo(), true);
    if (command === Command.Redo) return this.#stepHistory(this.#session.tryRedo(), false);
    if (command === Command.Restart) {
      this.#restart();
      return true;
    }
    return false;
  }

  async #step(dir) {
    this.#renderer.setPlayerFacing(dir);
    const move = this.#session.tryMove(dir);
    if (!move) return false;

    this.#hooks.onSound?.(move.push ? 'push' : 'step');
    await this.#animator.play(move);
    this.#afterMove(move);
    return true;
  }

  async #stepHistory(move, reverse) {
    if (!move) return false;

    this.#hooks.onSound?.('undo');
    await this.#animator.play(move, { reverse });
    this.#renderer.refreshBoxLook(this.#session.board);
    return true;
  }

  #restart() {
    this.#session.restart();
    this.#animator.snap(this.#session.board);
    this.#renderer.fitCellSize(this.#session.board);
  }

  /** Đổi sprite hộp ở CUỐI animation, không phải lúc bắt đầu. */
  #afterMove(move) {
    this.#renderer.refreshBoxLook(this.#session.board);

    const landedOnGoal = move.push
      && this.#session.board.cellAt(move.boxTo.x, move.boxTo.y) === CellType.Goal;
    if (landedOnGoal) this.#hooks.onSound?.('boxOnGoal');

    if (this.#session.isSolved) {
      this.#hooks.onSound?.('win');
      this.#hooks.onSolved?.();
    }
  }
}
```

- [ ] **Step 4: Thay `web/src/main.js`**

```js
import { GameSession } from './core/gameSession.js';
import { BoardRenderer } from './view/boardRenderer.js';
import { MoveAnimator } from './view/moveAnimator.js';
import { LevelPlayer } from './view/levelPlayer.js';
import { InputRouter } from './input/inputRouter.js';

const response = await fetch('src/levels/microban.json');
if (!response.ok) throw new Error(`Không tải được bộ màn: HTTP ${response.status}`);
const collection = await response.json();

const boardEl = document.getElementById('board');
const renderer = new BoardRenderer(boardEl);
const animator = new MoveAnimator(renderer, boardEl);
const router = new InputRouter();

const session = new GameSession(collection.levels[0]);
const player = new LevelPlayer({
  session,
  renderer,
  animator,
  router,
  hooks: { onSolved: () => console.log('Thắng màn!') },
});

router.onCommand((command) => player.handle(command));
router.attach();
player.start();

window.addEventListener('resize', () => {
  renderer.fitCellSize(session.board);
});
```

- [ ] **Step 5: Kiểm bằng mắt trên trình duyệt**

```bash
npx --yes serve web
```

Kỳ vọng, trên màn Microban 1:
- Mũi tên và WASD làm người chơi trượt sang ô kế tiếp trong khoảng 0,12 giây, không nhảy giật.
- Người chơi đổi mặt theo hướng đi.
- Đẩy được hộp; đẩy vào tường thì đứng yên.
- Hộp vào ô đích thì đổi sang sprite `box_on_goal` và **mất dấu X**; đẩy ra khỏi đích thì dấu X hiện lại.
- Giữ phím mũi tên thì đi liên tục đều nhịp, không khựng ở bước thứ hai.
- Đẩy nốt hộp cuối vào đích thì console in `Thắng màn!`.
- Đổi kích thước cửa sổ thì bàn cờ co giãn theo, không tràn.

- [ ] **Step 6: Commit**

```bash
git add web/src/view/moveAnimator.js web/src/input/inputRouter.js web/src/view/levelPlayer.js web/src/main.js
git commit -m "Đi và đẩy được, có animation và đệm input

Nhịp giữ phím do router tự lo thay vì dựa vào auto-repeat của hệ điều hành:
auto-repeat trễ nửa giây ở nhịp đầu nên cầm phím sẽ khựng một cái rồi mới chạy."
```

---

### Task 10: HUD, undo/redo/restart trên màn hình

**Files:**
- Create: `web/src/ui/hud.js`
- Create: `web/styles/ui.css`
- Modify: `web/index.html` (thêm thanh trên và hàng nút dưới, nạp `ui.css`)
- Modify: `web/src/main.js` (gắn HUD)

**Interfaces:**
- Consumes: `gameSession.js`, `inputRouter.js` (`Command`)
- Produces: `class Hud`: `constructor(rootEl, router)`, `bind(session): () => void` — gắn HUD vào một session, trả hàm gỡ; `setLevelLabel(text): void`

- [ ] **Step 1: Thêm markup HUD vào `web/index.html`**

Thay toàn bộ `<body>` bằng:

```html
<body>
  <main class="screen screen--play" data-name="play">
    <header class="hud" id="hud">
      <span class="hud__name" id="hud-name">Màn 1</span>
      <span class="hud__stat">Bước <b id="hud-moves">0</b></span>
      <span class="hud__stat">Đẩy <b id="hud-pushes">0</b></span>
      <span class="hud__spacer"></span>
      <button class="btn btn--ghost" id="btn-mute" type="button" aria-pressed="false">🔊</button>
    </header>

    <div class="stage" id="stage">
      <div class="board" id="board"></div>
    </div>

    <footer class="toolbar">
      <button class="btn" id="btn-undo" type="button">↶ Undo</button>
      <button class="btn" id="btn-redo" type="button">↷ Redo</button>
      <button class="btn" id="btn-restart" type="button">⟳ Chơi lại</button>
      <button class="btn" id="btn-exit" type="button">← Chọn màn</button>
    </footer>
  </main>

  <script type="module" src="src/main.js"></script>
</body>
```

Và thêm vào `<head>`, sau `board.css`:

```html
  <link rel="stylesheet" href="styles/ui.css">
```

- [ ] **Step 2: Viết `web/styles/ui.css`**

```css
.screen {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.hud {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--panel-line);
  font-size: 14px;
}

.hud__name { font-weight: 600; }
.hud__stat { color: var(--text-dim); }
.hud__stat b { color: var(--text); font-variant-numeric: tabular-nums; }
.hud__spacer { flex: 1; }

/*
 * `.stage` đã có rule trong board.css (display:flex, canh giữa, padding, min-height
 * 100vh). Trong màn chơi nó là ô flex nằm giữa HUD và hàng nút, nên chiều cao do
 * flex quyết định chứ không phải 100vh. Chỉ ghi đè đúng hai thuộc tính đó — ui.css
 * nạp sau board.css nên thắng.
 */
.stage {
  flex: 1;
  min-height: 0;
}

.toolbar {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 12px;
  background: var(--panel);
  border-top: 1px solid var(--panel-line);
}

.btn {
  padding: 7px 14px;
  border: 0;
  border-radius: 6px;
  background: #2b3542;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09);
}

.btn:hover:not(:disabled) { background: #35414f; }

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn--ghost {
  background: transparent;
  box-shadow: none;
}
```

- [ ] **Step 3: Viết `web/src/ui/hud.js`**

```js
import { Command } from '../input/inputRouter.js';

/** Thanh thông tin trên và hàng nút dưới. Bám theo session qua onChange. */
export class Hud {
  #name;
  #moves;
  #pushes;
  #undo;
  #redo;

  constructor(rootEl, router) {
    this.#name = rootEl.querySelector('#hud-name');
    this.#moves = rootEl.querySelector('#hud-moves');
    this.#pushes = rootEl.querySelector('#hud-pushes');
    this.#undo = rootEl.querySelector('#btn-undo');
    this.#redo = rootEl.querySelector('#btn-redo');

    router.bindButton(this.#undo, Command.Undo);
    router.bindButton(this.#redo, Command.Redo);
    router.bindButton(rootEl.querySelector('#btn-restart'), Command.Restart);
    router.bindButton(rootEl.querySelector('#btn-exit'), Command.Exit);
  }

  setLevelLabel(text) {
    this.#name.textContent = text;
  }

  /** Trả về hàm gỡ, để đổi màn không để lại listener bám vào session cũ. */
  bind(session) {
    const refresh = () => {
      this.#moves.textContent = String(session.moves);
      this.#pushes.textContent = String(session.pushes);
      this.#undo.disabled = !session.canUndo;
      this.#redo.disabled = !session.canRedo;
    };

    refresh();
    return session.onChange(refresh);
  }
}
```

- [ ] **Step 4: Gắn HUD trong `web/src/main.js`**

Thêm import và thay phần dựng session:

```js
import { Hud } from './ui/hud.js';
```

Sau khi tạo `router`, trước khi tạo `player`:

```js
const hud = new Hud(document.body, router);
```

Sau khi tạo `session`:

```js
hud.setLevelLabel(`Màn ${session.levelName}`);
hud.bind(session);
```

- [ ] **Step 5: Kiểm bằng mắt**

```bash
npx --yes serve web
```

Kỳ vọng: thanh trên hiện `Màn 1`, số bước và số đẩy tăng theo nước đi; nút Undo mờ khi chưa đi nước nào, sáng lên sau nước đầu; bấm Undo lùi được một nước và số bước giảm; nút Redo mờ trở lại sau khi đi nước mới; bấm Chơi lại đưa bàn cờ về đầu màn không có animation bay.

- [ ] **Step 6: Commit**

```bash
git add web/index.html web/styles/ui.css web/src/ui/hud.js web/src/main.js
git commit -m "Thêm HUD và hàng nút Undo/Redo/Chơi lại/Thoát

Hud.bind trả hàm gỡ listener: đổi màn mà không gỡ thì HUD của màn cũ vẫn
bám vào session cũ và số đếm nhảy loạn."
```

---

### Task 11: `progressStore`

**Files:**
- Create: `web/src/progress/progressStore.js`
- Test: `web/tests/progressStore.test.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `class ProgressStore`: `constructor(storage = globalThis.localStorage)`, `getRecord(collection, index): {index, completed, bestMoves, bestPushes}`, `recordCompletion(collection, index, moves, pushes): void`, `isUnlocked(collection, index): boolean`, `getLastPlayedIndex(collection): number`, `setLastPlayedIndex(collection, index): void`, `get muted(): boolean`, `set muted(v)`, `clear(): void`

- [ ] **Step 1: Viết test cho `progressStore.js`**

Tạo `web/tests/progressStore.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore } from '../src/progress/progressStore.js';

/** localStorage giả, đủ dùng cho ProgressStore — không cần trình duyệt. */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    get size() { return data.size; },
  };
}

test('màn chưa chơi trả về bản ghi rỗng', () => {
  const store = new ProgressStore(fakeStorage());
  assert.deepEqual(store.getRecord('Microban', 3), {
    index: 3, completed: false, bestMoves: 0, bestPushes: 0,
  });
});

test('hoàn thành lần đầu ghi thẳng kỷ lục', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);

  const record = store.getRecord('Microban', 0);
  assert.equal(record.completed, true);
  assert.equal(record.bestMoves, 33);
  assert.equal(record.bestPushes, 9);
});

test('kỷ lục chỉ bị ghi đè khi tốt hơn', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);
  store.recordCompletion('Microban', 0, 40, 12);
  assert.equal(store.getRecord('Microban', 0).bestMoves, 33);

  store.recordCompletion('Microban', 0, 30, 8);
  assert.equal(store.getRecord('Microban', 0).bestMoves, 30);
  assert.equal(store.getRecord('Microban', 0).bestPushes, 8);
});

test('số bước và số đẩy được so riêng', () => {
  const store = new ProgressStore(fakeStorage());
  store.recordCompletion('Microban', 0, 33, 9);
  store.recordCompletion('Microban', 0, 35, 7);

  assert.equal(store.getRecord('Microban', 0).bestMoves, 33);
  assert.equal(store.getRecord('Microban', 0).bestPushes, 7);
});

test('mở khoá tuần tự: màn đầu luôn mở, màn sau chờ màn trước', () => {
  const store = new ProgressStore(fakeStorage());
  assert.equal(store.isUnlocked('Microban', 0), true);
  assert.equal(store.isUnlocked('Microban', 1), false);

  store.recordCompletion('Microban', 0, 33, 9);
  assert.equal(store.isUnlocked('Microban', 1), true);
  assert.equal(store.isUnlocked('Microban', 2), false);
});

test('lastPlayedIndex ghi và đọc lại được', () => {
  const store = new ProgressStore(fakeStorage());
  assert.equal(store.getLastPlayedIndex('Microban'), 0);

  store.setLastPlayedIndex('Microban', 13);
  assert.equal(store.getLastPlayedIndex('Microban'), 13);
});

test('tắt tiếng lưu chung với tiến độ', () => {
  const storage = fakeStorage();
  const store = new ProgressStore(storage);
  store.muted = true;

  assert.equal(new ProgressStore(storage).muted, true);
});

test('dữ liệu ghi xuống đọc lại được bằng một store mới', () => {
  const storage = fakeStorage();
  new ProgressStore(storage).recordCompletion('Microban', 5, 20, 4);

  assert.equal(new ProgressStore(storage).getRecord('Microban', 5).bestMoves, 20);
});

test('JSON hỏng thì reset về rỗng thay vì ném lỗi', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{ vỡ toác' }));
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(store.muted, false);
});

test('JSON đúng cú pháp nhưng thiếu trường thì vẫn dùng được', () => {
  const store = new ProgressStore(fakeStorage({ 'sokoban.progress': '{"muted":true}' }));
  assert.equal(store.muted, true);
  assert.equal(store.getRecord('Microban', 0).completed, false);
});

test('storage ném lỗi lúc ghi thì game không chết', () => {
  const store = new ProgressStore({
    getItem: () => null,
    setItem: () => { throw new Error('hết chỗ'); },
    removeItem: () => {},
  });

  assert.doesNotThrow(() => store.recordCompletion('Microban', 0, 33, 9));
});

test('storage ném lỗi lúc đọc thì reset về rỗng, không ném ra ngoài', () => {
  // Chế độ riêng tư của một số trình duyệt ném lỗi ngay ở getItem, không phải setItem.
  const store = new ProgressStore({
    getItem: () => { throw new Error('bị chặn'); },
    setItem: () => {},
    removeItem: () => {},
  });

  assert.doesNotThrow(() => store.getRecord('Microban', 0));
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(store.muted, false);
});

test('clear xoá sạch tiến độ', () => {
  const storage = fakeStorage();
  const store = new ProgressStore(storage);
  store.recordCompletion('Microban', 0, 33, 9);

  store.clear();
  assert.equal(store.getRecord('Microban', 0).completed, false);
  assert.equal(new ProgressStore(storage).getRecord('Microban', 0).completed, false);
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó hỏng**

```bash
cd web && npm test
```

Kỳ vọng: FAIL, `Cannot find module .../src/progress/progressStore.js`.

- [ ] **Step 3: Viết `web/src/progress/progressStore.js`**

```js
const KEY = 'sokoban.progress';

/**
 * Tiến độ lưu dạng JSON trong localStorage. Giữ nguyên hình dạng của bản Unity
 * để sau này còn đối chiếu được.
 *
 * storage nhận từ ngoài vào để test cắm được localStorage giả — module này là
 * chỗ duy nhất trong game đụng tới localStorage.
 */
export class ProgressStore {
  #storage;
  #root = null;

  constructor(storage = globalThis.localStorage) {
    this.#storage = storage;
  }

  get #data() {
    if (this.#root) return this.#root;

    this.#root = { muted: false, collections: [] };

    // getItem nằm TRONG try: chế độ riêng tư của một số trình duyệt ném lỗi ngay
    // ở bước đọc, và lỗi đó thoát ra ngoài là chết game ngay lúc load.
    try {
      const raw = this.#storage.getItem(KEY);
      if (!raw) return this.#root;

      const parsed = JSON.parse(raw);
      this.#root = {
        muted: Boolean(parsed?.muted),
        collections: Array.isArray(parsed?.collections) ? parsed.collections : [],
      };
    } catch (error) {
      // Hỏng hoặc bị chặn thì bắt đầu lại — không được ném lỗi làm chết game.
      console.warn(`ProgressStore: không đọc được tiến độ, đặt lại từ đầu (${error.message})`);
      this.#root = { muted: false, collections: [] };
    }

    return this.#root;
  }

  #save() {
    try {
      this.#storage.setItem(KEY, JSON.stringify(this.#data));
    } catch (error) {
      // Chế độ riêng tư hoặc hết chỗ: chơi tiếp được, chỉ là không nhớ gì.
      console.warn(`ProgressStore: không lưu được tiến độ (${error.message})`);
    }
  }

  #collection(name) {
    let found = this.#data.collections.find((c) => c.name === name);
    if (!found) {
      found = { name, lastPlayedIndex: 0, levels: [] };
      this.#data.collections.push(found);
    }
    if (!Array.isArray(found.levels)) found.levels = [];
    return found;
  }

  getRecord(collection, index) {
    const coll = this.#collection(collection);
    let record = coll.levels.find((l) => l.index === index);
    if (!record) {
      record = { index, completed: false, bestMoves: 0, bestPushes: 0 };
      coll.levels.push(record);
    }
    return record;
  }

  recordCompletion(collection, index, moves, pushes) {
    const record = this.getRecord(collection, index);

    if (!record.completed) {
      record.completed = true;
      record.bestMoves = moves;
      record.bestPushes = pushes;
    } else {
      if (moves < record.bestMoves) record.bestMoves = moves;
      if (pushes < record.bestPushes) record.bestPushes = pushes;
    }

    this.#save();
  }

  /** Mở khoá tuần tự: màn 0 luôn mở, màn n mở khi màn n-1 đã xong. */
  isUnlocked(collection, index) {
    if (index <= 0) return true;
    return this.getRecord(collection, index - 1).completed;
  }

  getLastPlayedIndex(collection) {
    return this.#collection(collection).lastPlayedIndex ?? 0;
  }

  setLastPlayedIndex(collection, index) {
    this.#collection(collection).lastPlayedIndex = index;
    this.#save();
  }

  get muted() { return this.#data.muted; }

  set muted(value) {
    this.#data.muted = Boolean(value);
    this.#save();
  }

  clear() {
    // Đặt null chứ không phải object rỗng: lần đọc sau phải đi qua nhánh
    // đọc-và-bắt-lỗi, nếu không test JSON hỏng sẽ xanh vì lý do sai.
    this.#root = null;
    try {
      this.#storage.removeItem(KEY);
    } catch (error) {
      console.warn(`ProgressStore: không xoá được tiến độ (${error.message})`);
    }
  }
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó xanh**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 78 test.

- [ ] **Step 5: Commit**

```bash
git add web/src/progress/progressStore.js web/tests/progressStore.test.mjs
git commit -m "Thêm ProgressStore lưu tiến độ vào localStorage

Nhận storage từ ngoài vào để test cắm bản giả: nếu không thì nhóm test JSON
hỏng buộc phải chạy trong trình duyệt."
```

---

### Task 12: Luồng màn hình — menu, chọn màn, thắng màn

**Files:**
- Create: `web/src/ui/mainMenu.js`
- Create: `web/src/ui/levelSelect.js`
- Create: `web/src/ui/levelComplete.js`
- Create: `web/src/ui/gameFlow.js`
- Modify: `web/index.html` (thêm panel menu, chọn màn, overlay thắng màn)
- Modify: `web/styles/ui.css` (style cho các panel mới)
- Modify: `web/src/main.js` (bootstrap qua `GameFlow`)

**Interfaces:**
- Consumes: `gameSession.js`, `progressStore.js`, `boardRenderer.js`, `moveAnimator.js`, `levelPlayer.js`, `inputRouter.js`, `hud.js`
- Produces:
  - `class MainMenu`: `constructor(rootEl, { onContinue, onSelect, onToggleMute })`, `refresh(progress, collectionName, levels): void` — cần `levels` để lấy tên màn hiển thị, không được suy từ chỉ số
  - `class LevelSelect`: `constructor(rootEl, { onPick, onBack })`, `render(levels, progress, collectionName): void`
  - `class LevelComplete`: `constructor(rootEl, { onNext, onRetry, onSelect })`, `show({ moves, pushes, bestMoves, hasNext }): void`, `hide(): void`
  - `class GameFlow`: `constructor({ collection, progress, router, renderer, animator, hud, panels })`, `start(): void`

- [ ] **Step 1: Thêm markup panel vào `web/index.html`**

Thêm `data-screen="menu"` vào thẻ `<body>`, đổi `<main>` hiện có thành một trong ba panel, và thêm hai panel còn lại. `<body>` thành:

```html
<body data-screen="menu">
  <section class="screen screen--menu" data-name="menu">
    <div class="panel">
      <h1 class="panel__title">Sokoban</h1>
      <p class="panel__hint">Mũi tên hoặc WASD để đi · U hoàn tác · Y làm lại · R chơi lại màn · Esc thoát</p>
      <div class="panel__actions">
        <button class="btn btn--big" id="btn-continue" type="button">Chơi tiếp</button>
        <button class="btn btn--big" id="btn-levels" type="button">Chọn màn</button>
        <button class="btn btn--big" id="btn-menu-mute" type="button" aria-pressed="false">Tiếng: bật</button>
      </div>
    </div>
  </section>

  <section class="screen screen--levels" data-name="levels">
    <header class="hud">
      <span class="hud__name">Chọn màn</span>
      <span class="hud__spacer"></span>
      <button class="btn" id="btn-levels-back" type="button">← Menu</button>
    </header>
    <div class="levels" id="levels"></div>
  </section>

  <main class="screen screen--play" data-name="play">
    <header class="hud" id="hud">
      <span class="hud__name" id="hud-name">Màn 1</span>
      <span class="hud__stat">Bước <b id="hud-moves">0</b></span>
      <span class="hud__stat">Đẩy <b id="hud-pushes">0</b></span>
      <span class="hud__spacer"></span>
      <button class="btn btn--ghost" id="btn-mute" type="button" aria-pressed="false">🔊</button>
    </header>

    <div class="stage" id="stage">
      <div class="board" id="board"></div>

      <div class="overlay" id="complete" hidden>
        <div class="panel">
          <h2 class="panel__title">Xong màn!</h2>
          <p class="panel__stats" id="complete-stats"></p>
          <p class="panel__hint" id="complete-best"></p>
          <div class="panel__actions">
            <button class="btn btn--big" id="btn-next" type="button">Màn tiếp →</button>
            <button class="btn btn--big" id="btn-retry" type="button">Chơi lại</button>
            <button class="btn btn--big" id="btn-to-levels" type="button">Chọn màn</button>
          </div>
        </div>
      </div>
    </div>

    <footer class="toolbar">
      <button class="btn" id="btn-undo" type="button">↶ Undo</button>
      <button class="btn" id="btn-redo" type="button">↷ Redo</button>
      <button class="btn" id="btn-restart" type="button">⟳ Chơi lại</button>
      <button class="btn" id="btn-exit" type="button">← Chọn màn</button>
    </footer>
  </main>

  <script type="module" src="src/main.js"></script>
</body>
```

- [ ] **Step 2: Thêm style panel vào cuối `web/styles/ui.css`**

```css
/* Chỉ panel khớp với data-screen trên body mới hiện. */
.screen { display: none; }
body[data-screen="menu"] .screen[data-name="menu"],
body[data-screen="levels"] .screen[data-name="levels"],
body[data-screen="play"] .screen[data-name="play"] { display: flex; }

.screen--menu { align-items: center; justify-content: center; }

.panel {
  max-width: 460px;
  padding: 28px 32px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
  text-align: center;
}

.panel__title { margin: 0 0 10px; font-size: 30px; }
.panel__stats { margin: 0 0 4px; font-size: 17px; }
.panel__hint { margin: 0 0 20px; color: var(--text-dim); font-size: 13px; }

.panel__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn--big { padding: 11px 18px; font-size: 15px; }

.levels {
  flex: 1;
  align-content: start;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 10px;
  padding: 20px;
  overflow-y: auto;
}

.level-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 6px;
  border: 0;
  border-radius: 8px;
  background: #2b3542;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09);
}

.level-btn:hover:not(:disabled) { background: #35414f; }
.level-btn:disabled { opacity: 0.35; cursor: default; }
.level-btn--done { box-shadow: inset 0 0 0 1px var(--accent); }
.level-btn__num { font-size: 16px; font-weight: 600; }
.level-btn__best { font-size: 11px; color: var(--text-dim); min-height: 1em; }

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 12, 16, 0.82);
}

.overlay[hidden] { display: none; }

.empty {
  margin: auto;
  color: var(--text-dim);
  text-align: center;
}
```

`.stage` cần `position: relative` để overlay bám đúng chỗ. Sửa khối `.stage` đã có ở Task 10, thêm dòng:

```css
  position: relative;
```

- [ ] **Step 3: Viết `web/src/ui/mainMenu.js`**

```js
/** Màn hình đầu: chơi tiếp, chọn màn, bật tắt tiếng. */
export class MainMenu {
  #continueBtn;
  #muteBtn;

  constructor(rootEl, { onContinue, onSelect, onToggleMute }) {
    this.#continueBtn = rootEl.querySelector('#btn-continue');
    this.#muteBtn = rootEl.querySelector('#btn-menu-mute');

    this.#continueBtn.addEventListener('click', onContinue);
    rootEl.querySelector('#btn-levels').addEventListener('click', onSelect);
    this.#muteBtn.addEventListener('click', onToggleMute);
  }

  refresh(progress, collectionName, levels) {
    const last = progress.getLastPlayedIndex(collectionName);
    // Số hiển thị lấy từ tên màn chứ không phải chỉ số cộng một — bộ màn khác
    // có thể đặt tên không phải số.
    const name = levels[last]?.name;
    this.#continueBtn.textContent = last > 0 && name ? `Chơi tiếp (màn ${name})` : 'Chơi';

    const muted = progress.muted;
    this.#muteBtn.textContent = muted ? 'Tiếng: tắt' : 'Tiếng: bật';
    this.#muteBtn.setAttribute('aria-pressed', String(muted));
  }
}
```

- [ ] **Step 4: Viết `web/src/ui/levelSelect.js`**

```js
/** Lưới nút chọn màn. Mở khoá tuần tự, màn đã qua hiện số bước tốt nhất. */
export class LevelSelect {
  #grid;
  #onPick;

  constructor(rootEl, { onPick, onBack }) {
    this.#grid = rootEl.querySelector('#levels');
    this.#onPick = onPick;
    rootEl.querySelector('#btn-levels-back').addEventListener('click', onBack);
  }

  render(levels, progress, collectionName) {
    this.#grid.textContent = '';

    if (levels.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Bộ màn trống — chưa có màn nào để chơi.';
      this.#grid.append(empty);
      return;
    }

    levels.forEach((level, index) => {
      const record = progress.getRecord(collectionName, index);
      const unlocked = progress.isUnlocked(collectionName, index);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `level-btn${record.completed ? ' level-btn--done' : ''}`;
      button.disabled = !unlocked;

      const num = document.createElement('span');
      num.className = 'level-btn__num';
      num.textContent = record.completed ? `✓ ${level.name}` : level.name;

      const best = document.createElement('span');
      best.className = 'level-btn__best';
      best.textContent = record.completed ? `${record.bestMoves} bước` : '';

      button.append(num, best);
      button.addEventListener('click', () => this.#onPick(index));
      this.#grid.append(button);
    });
  }
}
```

- [ ] **Step 5: Viết `web/src/ui/levelComplete.js`**

```js
/** Overlay hiện sau khi giải xong một màn. */
export class LevelComplete {
  #root;
  #stats;
  #best;
  #nextBtn;

  constructor(rootEl, { onNext, onRetry, onSelect }) {
    this.#root = rootEl;
    this.#stats = rootEl.querySelector('#complete-stats');
    this.#best = rootEl.querySelector('#complete-best');
    this.#nextBtn = rootEl.querySelector('#btn-next');

    this.#nextBtn.addEventListener('click', onNext);
    rootEl.querySelector('#btn-retry').addEventListener('click', onRetry);
    rootEl.querySelector('#btn-to-levels').addEventListener('click', onSelect);
  }

  show({ moves, pushes, bestMoves, hasNext }) {
    this.#stats.textContent = `${moves} bước · ${pushes} lần đẩy`;
    this.#best.textContent = bestMoves > 0 && bestMoves < moves
      ? `Kỷ lục của bạn: ${bestMoves} bước`
      : 'Kỷ lục mới!';

    // Màn cuối bộ thì không có gì để đi tiếp.
    this.#nextBtn.hidden = !hasNext;
    if (!hasNext) this.#stats.textContent += ' — hết bộ màn, chúc mừng!';

    this.#root.hidden = false;
  }

  hide() {
    this.#root.hidden = true;
  }
}
```

- [ ] **Step 6: Viết `web/src/ui/gameFlow.js`**

```js
import { GameSession } from '../core/gameSession.js';
import { LevelPlayer } from '../view/levelPlayer.js';

/** Giữ màn hình hiện tại và điều phối các panel. */
export class GameFlow {
  #collection;
  #progress;
  #router;
  #renderer;
  #animator;
  #hud;
  #panels;
  #audio;

  #session = null;
  #player = null;
  #index = 0;
  #unbindHud = null;
  #unroute = null;

  constructor({ collection, progress, router, renderer, animator, hud, panels, audio }) {
    this.#collection = collection;
    this.#progress = progress;
    this.#router = router;
    this.#renderer = renderer;
    this.#animator = animator;
    this.#hud = hud;
    this.#panels = panels;
    this.#audio = audio;
  }

  get #collectionName() { return this.#collection.collectionName; }

  start() {
    this.#router.attach();
    this.showMenu();
  }

  showMenu() {
    this.#leaveLevel();
    this.#panels.menu.refresh(this.#progress, this.#collectionName, this.#collection.levels);
    document.body.dataset.screen = 'menu';
  }

  showLevelSelect() {
    this.#leaveLevel();
    this.#panels.levelSelect.render(this.#collection.levels, this.#progress, this.#collectionName);
    document.body.dataset.screen = 'levels';
  }

  playLevel(index) {
    this.#leaveLevel();

    const level = this.#collection.levels[index];
    if (!level) return;

    this.#index = index;
    this.#progress.setLastPlayedIndex(this.#collectionName, index);
    this.#panels.levelComplete.hide();

    this.#session = new GameSession(level);
    this.#player = new LevelPlayer({
      session: this.#session,
      renderer: this.#renderer,
      animator: this.#animator,
      router: this.#router,
      hooks: {
        onExit: () => this.showLevelSelect(),
        onSolved: () => this.#onSolved(),
        onSound: (name) => this.#audio.play(name),
      },
    });

    this.#hud.setLevelLabel(`Màn ${level.name}`);
    this.#unbindHud = this.#hud.bind(this.#session);
    this.#unroute = this.#router.onCommand((command) => this.#player.handle(command));

    document.body.dataset.screen = 'play';
    this.#player.start();
  }

  /** Đổi kích thước cửa sổ: tính lại cỡ ô cho màn đang chơi. */
  handleResize() {
    if (this.#session) this.#renderer.fitCellSize(this.#session.board);
  }

  #onSolved() {
    // Thắng rồi thì ngắt luồng input chơi. Overlay đang che bàn cờ, mà undo vẫn
    // chạy được thì người chơi bấm U theo phản xạ sẽ đổi bàn cờ sau lưng overlay.
    // Nút trên overlay gắn trực tiếp nên không bị ảnh hưởng.
    this.#unroute?.();
    this.#unroute = null;

    const record = this.#progress.getRecord(this.#collectionName, this.#index);
    const bestMoves = record.completed ? record.bestMoves : 0;

    this.#progress.recordCompletion(
      this.#collectionName, this.#index, this.#session.moves, this.#session.pushes,
    );

    this.#panels.levelComplete.show({
      moves: this.#session.moves,
      pushes: this.#session.pushes,
      bestMoves,
      hasNext: this.#index + 1 < this.#collection.levels.length,
    });
  }

  nextLevel() {
    this.playLevel(this.#index + 1);
  }

  retryLevel() {
    this.playLevel(this.#index);
  }

  /** Gỡ hết listener của màn cũ trước khi rời đi, không thì chúng bám mãi. */
  #leaveLevel() {
    this.#unbindHud?.();
    this.#unroute?.();
    this.#unbindHud = null;
    this.#unroute = null;
    this.#session = null;
    this.#player = null;
    this.#panels.levelComplete.hide();
  }
}
```

- [ ] **Step 7: Thay `web/src/main.js`**

```js
import { BoardRenderer } from './view/boardRenderer.js';
import { MoveAnimator } from './view/moveAnimator.js';
import { InputRouter } from './input/inputRouter.js';
import { ProgressStore } from './progress/progressStore.js';
import { Hud } from './ui/hud.js';
import { MainMenu } from './ui/mainMenu.js';
import { LevelSelect } from './ui/levelSelect.js';
import { LevelComplete } from './ui/levelComplete.js';
import { GameFlow } from './ui/gameFlow.js';

let collection;
try {
  const response = await fetch('src/levels/microban.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  collection = await response.json();
} catch (error) {
  // Không có bộ màn thì hiện lời nhắn, không để người chơi nhìn màn hình trắng.
  console.error(`Không tải được bộ màn: ${error.message}`);
  document.body.dataset.screen = 'levels';
  document.getElementById('levels').innerHTML =
    '<p class="empty">Không tải được bộ màn. Thử tải lại trang.</p>';
  throw error;
}

const boardEl = document.getElementById('board');
const renderer = new BoardRenderer(boardEl);
const animator = new MoveAnimator(renderer, boardEl);
const router = new InputRouter();
const progress = new ProgressStore();
const hud = new Hud(document.body, router);

// Tạm thời chưa có tiếng; Task 13 thay bằng AudioService thật.
const audio = { play() {}, get muted() { return progress.muted; }, set muted(v) { progress.muted = v; } };

const panels = {
  menu: new MainMenu(document.body, {
    onContinue: () => flow.playLevel(progress.getLastPlayedIndex(collection.collectionName)),
    onSelect: () => flow.showLevelSelect(),
    onToggleMute: () => {
      audio.muted = !audio.muted;
      panels.menu.refresh(progress, collection.collectionName, collection.levels);
    },
  }),
  levelSelect: new LevelSelect(document.body, {
    onPick: (index) => flow.playLevel(index),
    onBack: () => flow.showMenu(),
  }),
  levelComplete: new LevelComplete(document.getElementById('complete'), {
    onNext: () => flow.nextLevel(),
    onRetry: () => flow.retryLevel(),
    onSelect: () => flow.showLevelSelect(),
  }),
};

const flow = new GameFlow({ collection, progress, router, renderer, animator, hud, panels, audio });
flow.start();

window.addEventListener('resize', () => flow.handleResize());
```

- [ ] **Step 8: Kiểm bằng mắt cả luồng**

```bash
npx --yes serve web
```

Kỳ vọng:
- Mở trang thấy menu. Bấm **Chọn màn** → lưới 155 nút, chỉ màn 1 bấm được, còn lại mờ.
- Bấm màn 1 → vào chơi. Giải xong → overlay hiện số bước, số đẩy và "Kỷ lục mới!".
- Bấm **Màn tiếp** → vào màn 2 và chơi được.
- `Esc` hoặc nút **Chọn màn** → quay ra lưới, màn 1 có dấu ✓ kèm số bước, màn 2 đã mở khoá.
- Về menu, nút đầu đọc là **Chơi tiếp (màn 2)**.
- Tải lại trang (F5) → tiến độ còn nguyên.
- Chơi lại màn đã qua với số bước nhiều hơn → kỷ lục cũ giữ nguyên trong lưới chọn màn.

- [ ] **Step 9: Commit**

```bash
git add web/index.html web/styles/ui.css web/src/ui web/src/main.js
git commit -m "Nối menu, chọn màn và panel thắng màn thành một luồng

GameFlow gỡ listener của màn cũ trước khi vào màn mới: nếu không, mỗi lần
đổi màn lại chồng thêm một bộ listener và một phím bấm sẽ đi nhiều bước."
```

---

### Task 13: Âm thanh

**Files:**
- Create: `web/src/audio/audioService.js`
- Modify: `web/src/main.js` (thay object tạm bằng `AudioService`, gắn nút tắt tiếng trên HUD)

**Interfaces:**
- Consumes: `progressStore.js`
- Produces: `class AudioService`: `constructor(progress)`, `play(name: 'step'|'push'|'boxOnGoal'|'win'|'undo'): void`, `unlock(): void`, `get muted(): boolean`, `set muted(v)`

- [ ] **Step 1: Viết `web/src/audio/audioService.js`**

```js
const AUDIO = 'assets/audio';

const SFX = {
  step: `${AUDIO}/step.ogg`,
  push: `${AUDIO}/push.ogg`,
  boxOnGoal: `${AUDIO}/box_on_goal.ogg`,
  win: `${AUDIO}/win.ogg`,
  undo: `${AUDIO}/undo.ogg`,
};

/**
 * SFX và nhạc nền. Trình duyệt chặn autoplay trước thao tác đầu tiên của người
 * dùng, nên nhạc nền chỉ bắt đầu khi unlock() được gọi từ trong một sự kiện
 * chuột hoặc bàn phím.
 */
export class AudioService {
  #progress;
  #buffers = new Map();
  #music;
  #unlocked = false;

  constructor(progress) {
    this.#progress = progress;

    for (const [name, src] of Object.entries(SFX)) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      this.#buffers.set(name, audio);
    }

    this.#music = new Audio(`${AUDIO}/music_loop.mp3`);
    this.#music.loop = true;
    this.#music.volume = 0.35;
  }

  get muted() { return this.#progress.muted; }

  set muted(value) {
    this.#progress.muted = value;
    if (value) this.#music.pause();
    else if (this.#unlocked) void this.#music.play().catch(() => {});
  }

  unlock() {
    if (this.#unlocked) return;
    this.#unlocked = true;
    if (!this.muted) void this.#music.play().catch(() => {});
  }

  play(name) {
    if (this.muted) return;

    const source = this.#buffers.get(name);
    if (!source) return;

    // Clone để hai tiếng chồng nhau được: bấm phím nhanh mà dùng chung một node
    // thì tiếng trước bị cắt ngang.
    const clip = source.cloneNode();
    clip.volume = 0.7;
    void clip.play().catch(() => {});
  }
}
```

- [ ] **Step 2: Thay object âm thanh tạm trong `web/src/main.js`**

Thêm import:

```js
import { AudioService } from './audio/audioService.js';
```

Thay dòng tạo `audio` tạm bằng:

```js
const audio = new AudioService(progress);

// Trình duyệt chỉ cho phát tiếng từ trong một thao tác thật của người dùng.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
```

Và sau khi tạo `panels`, gắn nút tắt tiếng trên HUD:

```js
const hudMute = document.getElementById('btn-mute');
const refreshMuteButton = () => {
  hudMute.textContent = audio.muted ? '🔇' : '🔊';
  hudMute.setAttribute('aria-pressed', String(audio.muted));
};
hudMute.addEventListener('click', () => {
  audio.muted = !audio.muted;
  refreshMuteButton();
});
refreshMuteButton();
```

Và trong callback `onToggleMute` của `panels.menu`, thêm `refreshMuteButton();` sau khi đổi `audio.muted` — hai nút phải luôn nói cùng một điều.

- [ ] **Step 3: Kiểm bằng mắt và bằng tai**

```bash
npx --yes serve web
```

Kỳ vọng: nhạc nền bắt đầu ngay sau cú bấm hoặc phím đầu tiên, không phát lúc vừa load. Đi có tiếng bước, đẩy có tiếng đẩy, hộp vào đích có tiếng riêng, giải xong có tiếng thắng, undo có tiếng undo. Giữ phím đi nhanh thì tiếng bước chồng nhau chứ không bị cắt cụt. Bấm 🔊 tắt hết tiếng kể cả nhạc; tải lại trang thì vẫn tắt. Console không có lỗi autoplay.

- [ ] **Step 4: Commit**

```bash
git add web/src/audio/audioService.js web/src/main.js
git commit -m "Thêm âm thanh, nhạc nền chờ thao tác đầu tiên

SFX phát qua node clone: dùng chung một node thì bấm phím nhanh sẽ cắt ngang
tiếng trước, nghe như game bị giật."
```

---

### Task 14: Level editor cho dev

**Files:**
- Create: `web/editor/index.html`
- Create: `web/editor/editor.js`

**Interfaces:**
- Consumes: `parseMicroban.js`, `levelValidator.js`, `sokobanChars.js`
- Produces: trang độc lập, không có export nào cho phần còn lại của game

- [ ] **Step 1: Viết `web/editor/index.html`**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sokoban — Level editor</title>
  <link rel="stylesheet" href="../styles/base.css">
  <link rel="stylesheet" href="../styles/ui.css">
  <style>
    .editor { padding: 20px; display: grid; gap: 16px; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .grid { display: grid; gap: 1px; width: max-content; background: var(--panel-line); }
    .grid button {
      width: 26px; height: 26px; border: 0; cursor: pointer;
      background: #232a34; color: var(--text); font: 14px/1 monospace;
    }
    .grid button[data-char="#"] { background: #5e6878; }
    .grid button[data-char="."] { background: #4a2523; }
    .grid button[data-char="$"], .grid button[data-char="*"] { background: #9c5f2c; }
    .grid button[data-char="@"], .grid button[data-char="+"] { background: #2f7fd4; }
    .brush[aria-pressed="true"] { outline: 2px solid var(--accent); }
    .issues { color: #ff9c94; white-space: pre-line; min-height: 1.5em; }
    textarea { width: 100%; min-height: 130px; background: #0e1218; color: var(--text);
               border: 1px solid var(--panel-line); border-radius: 6px; padding: 8px;
               font: 12px/1.45 monospace; }
  </style>
</head>
<body>
  <div class="editor">
    <h1 class="panel__title" style="text-align:left">Level editor</h1>

    <div class="row" id="brushes"></div>

    <div class="row">
      Rộng <input id="width" type="number" min="3" max="40" value="9">
      Cao <input id="height" type="number" min="3" max="24" value="7">
      <button class="btn" id="btn-resize" type="button">Đổi kích thước</button>
      <button class="btn" id="btn-clear" type="button">Xoá sạch</button>
      <button class="btn" id="btn-check" type="button">Kiểm tra</button>
      <button class="btn" id="btn-export" type="button">Xuất JSON</button>
    </div>

    <div class="grid" id="grid"></div>
    <p class="issues" id="issues"></p>

    <div class="row" style="width:100%">
      <button class="btn" id="btn-import" type="button">Import .txt</button>
      <span class="panel__hint" style="margin:0">Dán nội dung Microban vào ô dưới rồi bấm Import</span>
    </div>
    <textarea id="io" spellcheck="false"></textarea>
  </div>

  <script type="module" src="editor.js"></script>
</body>
</html>
```

- [ ] **Step 2: Viết `web/editor/editor.js`**

```js
import { parseMicroban } from '../src/levels/parseMicroban.js';
import { validateLevel } from '../src/levels/levelValidator.js';
import { WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, PLAYER, PLAYER_ON_GOAL } from '../src/levels/sokobanChars.js';

const BRUSHES = [
  { char: WALL, label: 'Tường #' },
  { char: FLOOR, label: 'Nền' },
  { char: GOAL, label: 'Đích .' },
  { char: BOX, label: 'Hộp $' },
  { char: BOX_ON_GOAL, label: 'Hộp trên đích *' },
  { char: PLAYER, label: 'Người @' },
  { char: PLAYER_ON_GOAL, label: 'Người trên đích +' },
];

const gridEl = document.getElementById('grid');
const issuesEl = document.getElementById('issues');
const ioEl = document.getElementById('io');
const widthEl = document.getElementById('width');
const heightEl = document.getElementById('height');

let brush = WALL;
let rows = [];

function makeEmpty(width, height) {
  return Array.from({ length: height }, () => FLOOR.repeat(width));
}

function setCell(x, y, char) {
  const row = rows[y];
  rows[y] = row.slice(0, x) + char + row.slice(x + 1);
}

function drawGrid() {
  const width = rows[0]?.length ?? 0;
  gridEl.style.gridTemplateColumns = `repeat(${width}, 26px)`;
  gridEl.textContent = '';

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.char = row[x];
      cell.textContent = row[x] === FLOOR ? '' : row[x];
      cell.addEventListener('click', () => {
        setCell(x, y, brush);
        drawGrid();
      });
      gridEl.append(cell);
    }
  });
}

function currentLevel() {
  const width = Math.max(...rows.map((r) => r.length));
  return { name: 'editor', width, height: rows.length, rows: rows.map((r) => r.padEnd(width)) };
}

function buildBrushes() {
  const bar = document.getElementById('brushes');
  BRUSHES.forEach(({ char, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn brush';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(char === brush));
    button.addEventListener('click', () => {
      brush = char;
      for (const other of bar.children) other.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
    });
    bar.append(button);
  });
}

document.getElementById('btn-resize').addEventListener('click', () => {
  rows = makeEmpty(Number(widthEl.value), Number(heightEl.value));
  drawGrid();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  // Giữ đúng kích thước lưới đang vẽ chứ không lấy theo ô nhập — người dùng có
  // thể đã gõ số mới mà chưa bấm Đổi kích thước. Lưới rỗng thì lùi về ô nhập,
  // vì rows[0].length khi đó ném lỗi.
  const width = rows[0]?.length ?? Number(widthEl.value);
  const height = rows.length || Number(heightEl.value);
  rows = makeEmpty(width, height);
  drawGrid();
});

document.getElementById('btn-check').addEventListener('click', () => {
  const issues = validateLevel(currentLevel());
  issuesEl.textContent = issues.length === 0 ? 'Màn hợp lệ.' : issues.join('\n');
});

document.getElementById('btn-export').addEventListener('click', () => {
  ioEl.value = JSON.stringify(currentLevel(), null, 1);
  ioEl.select();
});

document.getElementById('btn-import').addEventListener('click', () => {
  const { levels, errors } = parseMicroban(ioEl.value);
  const lines = [...errors];

  if (levels.length === 0) {
    lines.push('Không đọc được màn nào.');
  } else {
    // Import nhiều màn thì lấy màn đầu — editor này sửa từng màn một.
    rows = [...levels[0].rows];
    widthEl.value = String(levels[0].width);
    heightEl.value = String(levels[0].height);
    drawGrid();
    lines.push(`Đã nạp màn "${levels[0].name}" (${levels.length} màn trong nguồn).`);
  }

  // Gom lỗi và kết quả rồi ghi một lần. Ghi đè từng bước thì lỗi parse biến mất
  // ngay khi có ít nhất một màn đọc được — mà đó chính là lúc cần thấy lỗi nhất.
  // Ghi một lần cũng xoá luôn thông báo cũ của lần bấm trước.
  issuesEl.textContent = lines.join('\n');
});

buildBrushes();
rows = makeEmpty(Number(widthEl.value), Number(heightEl.value));
drawGrid();
```

- [ ] **Step 3: Kiểm bằng tay**

```bash
npx --yes serve web
```

Mở `/editor/`. Kỳ vọng:
- Vẽ được tường, nền, đích, hộp, người bằng cách chọn cọ rồi bấm vào ô.
- **Kiểm tra** trên lưới trống báo thiếu người chơi; vẽ đủ một người, một hộp, một đích trong khung tường kín thì báo "Màn hợp lệ."
- Vẽ khung hở một ô rồi Kiểm tra thì báo "Vùng chơi chưa kín".
- Dán ba màn Microban đầu vào ô text rồi **Import .txt** → lưới nạp màn 1 và báo "3 màn trong nguồn".
- **Xuất JSON** cho ra JSON có `name`, `width`, `height`, `rows`.

- [ ] **Step 4: Commit**

```bash
git add web/editor
git commit -m "Thêm level editor cho dev, dùng lại parser và validator của game

Editor không có bản sao luật riêng: nút Kiểm tra gọi thẳng levelValidator nên
màn hợp lệ trong editor chắc chắn hợp lệ lúc chơi."
```

---

### Task 15: Deploy lên GitHub Pages

**Files:**
- Create: `.github/workflows/pages.yml`
- Create: `web/README.md`

**Interfaces:**
- Consumes: toàn bộ `web/`
- Produces: workflow deploy; không có export code

- [ ] **Step 1: Viết `.github/workflows/pages.yml`**

```yaml
name: Deploy bản web lên GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Chạy test lõi
        run: npm test
        working-directory: web

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - name: Gom phần tĩnh, bỏ đồ chỉ dùng lúc dev
        run: |
          mkdir -p dist
          cp -r web/. dist/
          rm -rf dist/editor dist/tests dist/tools dist/package.json

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

Không có bước build — workflow chỉ copy file tĩnh. `npm test` chạy được mà không cần `npm install` vì dự án không có dependency nào.

- [ ] **Step 2: Viết `web/README.md`**

````markdown
# Sokoban — bản web

HTML + CSS + JavaScript thuần. Không framework, không build step.

## Chạy lúc dev

```bash
npx serve web
```

Phải mở qua http. **Không** double-click `index.html`: `file://` chặn ES module và `fetch`,
game sẽ trắng trang.

## Test

```bash
cd web && npm test
```

Chạy `node --test` trên phần lõi (`src/core`, `src/levels`, `src/progress`). Lớp hiển thị
không có test tự động — kiểm bằng mắt trên trình duyệt.

## Đổi bộ màn

`src/levels/microban.json` sinh ra từ `../Assets/Levels/microban.txt`, chạy tay rồi commit:

```bash
cd web && node tools/import-microban.mjs
```

## Level editor

Mở `/editor/` qua local server. Trang này không nằm trong bản deploy.
````

- [ ] **Step 3: Chạy lại toàn bộ test lần cuối**

```bash
cd web && npm test
```

Kỳ vọng: PASS, 78 test, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pages.yml web/README.md
git commit -m "Deploy web/ lên Pages, chặn deploy khi test đỏ

Bước gom file loại editor, tests và tools: chúng chỉ dùng lúc dev và không
có lý do gì để nằm trên bản công khai."
```

- [ ] **Step 5: Bật GitHub Pages cho repo**

Việc này làm trên giao diện GitHub, không làm bằng lệnh được: **Settings → Pages → Source → GitHub Actions**. Sau khi merge vào `main`, workflow chạy và in URL ở phần `environment` của job `deploy`.

---

## Self-Review

**Spec coverage** — đối chiếu từng mục của spec với task:

| Mục spec | Task |
|---|---|
| §3 Cấu trúc thư mục | 1, 8 |
| §4 Lõi luật chơi + §4.1 Luật chơi | 2, 3, 4 |
| §5 Dữ liệu màn (parser, validator, JSON) | 5, 6, 7 |
| §6.1 Art lai | 8 |
| §6.2 Cấu trúc DOM | 8 |
| §6.3 Kích thước ô | 8 (`fitCellSize`) |
| §6.4 Animation | 9 |
| §7 Điều khiển | 9 (bàn phím, giữ phím), 10 (nút) |
| §8 Luồng game và UI | 10, 12 |
| §9 Lưu tiến độ | 11 |
| §10 Âm thanh | 13 |
| §11 Level editor | 14 |
| §12 Test | 1–7, 11 |
| §13 Xử lý lỗi | 7 (import dừng khi màn hỏng), 8 (sprite thiếu → ô hồng), 11 (JSON hỏng, storage chặn), 12 (bộ màn rỗng, fetch lỗi) |
| §14 Deploy | 15 |

**Placeholder scan** — không có "TBD", "TODO", "tương tự task N", hay bước nào chỉ mô tả mà không có code.

**Type consistency** — các tên đã đối chiếu chéo: `countPieces` khai báo ở Task 1, dùng ở Task 5 và Task 6 (trả thêm `playerPos` vì validator cần điểm bắt đầu để loang); `boxKey` (Task 2) dùng lại ở Task 3 và 8; `Move` có đúng các trường `dir/blocked/push/from/to/boxFrom/boxTo` ở Task 3, 9; `renderer.placeActor` / `boxElAt` / `rekeyBox` / `refreshBoxLook` / `fitCellSize` / `playerEl` khai báo ở Task 8 và gọi ở Task 9; `session.onChange` trả hàm gỡ (Task 4) và được dùng đúng kiểu đó ở Task 10; `Command` và `commandToDirection` khai báo ở Task 9, dùng ở Task 10; `progress.getRecord/isUnlocked/recordCompletion/setLastPlayedIndex/muted` khai báo Task 11, dùng ở Task 12; `audio.play(name)` nhận đúng 5 tên `step`/`push`/`boxOnGoal`/`win`/`undo` ở Task 9 và Task 13.

---

## Sai sót của chính kế hoạch này (ghi lại sau khi thi công)

Review từng task và review cuối nhánh bắt được sáu lỗi nằm trong **văn bản kế hoạch**, không phải do
người thi công chép sai. Ghi lại để lần sau viết kế hoạch không lặp lại:

1. **`fitCellSize` đo một khung không có kích thước riêng.** `#stage` co theo bàn cờ, nên phép đo chiều
   cao rút gọn thành chính cỡ ô đang có. Bài học: khi code đo một phần tử, kế hoạch phải nói rõ phần tử
   đó lấy kích thước từ đâu.
2. **`ProgressStore` đọc `localStorage` ngoài `try`.** Chế độ riêng tư ném lỗi ngay ở `getItem`, không
   phải `setItem`.
3. **`ProgressStore` chỉ kiểm hai tầng.** JSON đúng cú pháp nhưng sai hình dạng (`{"collections":[null]}`)
   vẫn làm chết game lúc load — trái đúng điều mục 9 và 13 hứa.
4. **`MainMenu` suy số màn từ chỉ số cộng một** trong khi Global Constraints của chính kế hoạch cấm điều
   đó, và `refresh` còn không được truyền `levels` để tra tên. Kế hoạch tự mâu thuẫn với ràng buộc của nó.
5. **`LevelPlayer` không có cách dừng.** Kế hoạch định nghĩa một object sở hữu vòng lặp async mà chỉ cho
   nó `start()`, nên `GameFlow` không có gì để gọi lúc rời màn. Bài học: object nào giữ vòng lặp async thì
   phần Interfaces phải bắt buộc có `stop()` đi kèm `start()`.
6. **Cửa sổ tắt transition đóng sớm một nhịp.** `snap()` gỡ lớp `board--no-anim` rồi mới tới `fitCellSize`,
   mà đổi cỡ ô là đổi transform của mọi actor — nên actor trượt đúng vào lúc mục 6.4 bảo là không được trượt.

Ba lỗi cuối chỉ lộ ra ở review toàn nhánh: review từng task nhìn một diff nên không thấy được đường nối
giữa các task. Đó là lý do bước review cuối tồn tại.
