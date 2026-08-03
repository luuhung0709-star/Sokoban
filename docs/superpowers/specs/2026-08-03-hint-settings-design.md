# Thiết kế: bỏ Redo, thêm Hint và Settings

Ngày: 2026-08-03

## 1. Mục tiêu

Ba thay đổi ở lớp giao diện của bản web:

1. **Bỏ hẳn Redo** — gỡ khỏi cả UI lẫn model, không chỉ ẩn nút.
2. **Thêm Hint** — một solver chạy tại chỗ, giải từ đúng trạng thái hiện tại của bàn cờ, tô sáng
   thùng cần đẩy tiếp theo và hướng đẩy.
3. **Thêm Settings** — một overlay chứa hai công tắc âm thanh riêng biệt (nhạc nền, hiệu ứng), thay
   cho hai nút mute rời rạc đang có.

Thành công khi: thanh nút dưới màn chơi là `Undo · Hint · Restart · Settings · Select level`, bấm
Hint ở một màn Microban bất kỳ trong 100 màn đầu thì trong vòng vài giây có thùng được tô sáng kèm
mũi tên đúng hướng, tắt nhạc nền mà vẫn còn tiếng bước chân, và `npm test` xanh.

Chữ trên giao diện **giữ tiếng Anh**, theo commit `d333623` đã dịch toàn bộ bản web sang tiếng Anh.
Spec này viết bằng tiếng Việt, còn mọi chuỗi hiển thị cho người chơi đều là tiếng Anh.

## 2. Quyết định chốt

| Quyết định | Chốt | Lý do |
|---|---|---|
| Cách sinh gợi ý | Solver chạy tại chỗ | Lời giải dựng sẵn chỉ đúng khi người chơi đi khớp từ đầu; đi lệch một nước là vô dụng. Solver giải từ trạng thái hiện tại nên luôn đúng. |
| Nội dung gợi ý | Thùng + hướng đẩy kế tiếp | Phần khó của Sokoban là biết đẩy thùng nào đi đâu; phần đi bộ tới đó là phần dễ, để người chơi tự làm. |
| Nơi chạy solver | Web Worker | Giải có thể mất vài giây. Chạy trên main thread thì đơ tab. |
| Nội dung Settings | Chỉ hai công tắc âm thanh | YAGNI. Tốc độ animation, xoá tiến trình, bảng phím tắt đều đã cân nhắc và loại. |
| Vị trí Settings | Menu chính + thanh nút khi chơi | Một đường dẫn duy nhất để chỉnh âm thanh, thay cả hai nút mute cũ. |
| Ngôn ngữ UI | Tiếng Anh | Nhất quán với phần còn lại của bản web. |

## 3. Bỏ Redo

Redo hiện xuyên suốt sáu file. Gỡ sạch cả stack `#undone` chứ không để lại code chết.

| File | Thay đổi |
|---|---|
| `web/index.html` | Xoá `#btn-redo`. Sửa dòng phím tắt ở menu thành `Arrows or WASD to move · U undo · H hint · R restart level · Esc exit`. |
| `web/src/input/inputRouter.js` | Xoá `Command.Redo` và ánh xạ `KeyY`. Thêm `Command.Hint` ← `KeyH`. |
| `web/src/core/moveHistory.js` | Xoá stack `#undone`, `canRedo`, `popForRedo`. `record` không cần xoá nhánh redo nữa. `popForUndo` chỉ còn `this.#done.pop()`. |
| `web/src/core/gameSession.js` | Xoá `tryRedo()` và getter `canRedo`. |
| `web/src/view/levelPlayer.js` | Xoá nhánh `Command.Redo` trong `#dispatch`. `#stepHistory` bỏ tham số `reverse` — undo bây giờ luôn là reverse, nên gọi thẳng `this.#animator.play(move, { reverse: true })`. |
| `web/src/ui/hud.js` | Xoá field `#redo` và dòng `bindButton`. Xoá dòng gán `this.#redo.disabled` trong `refresh`. |

`MoveHistory` sau khi rút gọn còn khoảng 15 dòng và chỉ là một stack. Vẫn giữ nguyên lớp này thay vì
nhét mảng thẳng vào `GameSession`: nó có test riêng và giữ `GameSession` khỏi phình.

## 4. Hint

### 4.1 `web/src/core/solver.js` — thuần, không chạm DOM

Hàm public duy nhất:

```js
solveNextPush(snapshot, { maxNodes = 150_000, maxMs = 5_000 } = {})
  → { box: { x, y }, dir } | null
```

`snapshot` là dữ liệu thuần (xem 4.3), không phải instance `Board` — solver chạy trong worker, nơi
không có class nào của game.

Tìm kiếm theo **nước đẩy**, không theo bước đi. Người chơi đi bộ giữa hai lần đẩy là chuyện vặt;
coi mỗi lần đẩy là một cạnh của đồ thị làm không gian trạng thái nhỏ đi hàng chục lần.

**Bước 1 — bản đồ khoảng cách kéo (`pullDistance`).** BFS ngược từ mọi ô đích, mô phỏng thao tác
*kéo* thùng (nghịch đảo của đẩy). Từ ô `X` đã có khoảng cách, với mỗi hướng `d`, ô `prev = X + d`
nhận khoảng cách `+1` nếu `prev` là sàn **và** `prev + d` cũng là sàn — vì để đẩy thùng từ `prev`
sang `X` người chơi phải đứng được ở `prev + d`.

Một lần BFS này cho luôn hai thứ:

- **Ô chết**: ô sàn nào BFS không tới được thì thùng vào đó là hỏng vĩnh viễn. Cắt mọi nước đẩy
  vào ô chết.
- **Heuristic**: `h = Σ pullDistance[thùng]` trên mọi thùng. Đây là cận dưới thật của số nước đẩy
  còn lại (nó bỏ qua các thùng khác và bỏ qua việc người chơi có đi tới được không — cả hai chỉ
  làm chi phí thật tăng lên), nên heuristic này admissible. Nó cũng bám tường tốt hơn Manhattan
  nhiều.

**Bước 2 — mã hoá trạng thái.** Khoá trạng thái = danh sách ô có thùng đã sắp xếp, cộng vị trí
người chơi **đã chuẩn hoá**: ô nhỏ nhất theo thứ tự `(y, x)` trong vùng người chơi đi tới được với
bộ thùng đó. Nhờ chuẩn hoá, mọi vị trí người chơi trong cùng một vùng đều là một trạng thái — đi
bộ lòng vòng không sinh trạng thái mới.

**Bước 3 — sinh nước kế tiếp.** BFS vùng người chơi đi tới được (chặn bởi tường và thùng). Với mỗi
thùng `b` và mỗi hướng `d`, nước đẩy hợp lệ khi:

- ô `b - d` (chỗ người chơi đứng để đẩy) nằm trong vùng đi tới được, **và**
- ô `b + d` là sàn, không có thùng, và không phải ô chết.

Sau nước đẩy: thùng ở `b + d`, người chơi ở `b`.

**Bước 4 — cắt tỉa khối 2×2 đóng băng.** Sau khi đẩy thùng tới `X`, xét bốn khối 2×2 chứa `X`. Nếu
có khối nào mà cả bốn ô đều là tường-hoặc-thùng, **và** trong khối đó có ít nhất một thùng không
nằm trên ô đích, thì bỏ nhánh này.

Phép cắt này **đúng chắc chắn**, không phải phỏng đoán: trong một khối 2×2 kín, mỗi thùng đều có
một ô bị chặn ở cả trục ngang lẫn trục dọc *ngay trong khối*, nên không đẩy được theo trục nào cả;
mà các ô chặn nó lại là tường hoặc là thùng cũng bị khoá y hệt. Cả khối bất động vĩnh viễn.

> Lưu ý cho người thi công: **đừng** nới thành "thùng bị chặn một ô ngang và một ô dọc là đóng
> băng". Cách nới đó sai — thùng chặn bên cạnh có thể đẩy đi chỗ khác được, và ta sẽ cắt nhầm
> nhánh có lời giải. Phải đủ cả bốn ô của một khối 2×2.

Bộ cắt tỉa này **không bắt hết** mọi thế kẹt, và như vậy là chấp nhận được: sót một thế kẹt chỉ
làm tìm kiếm chậm hơn, không bao giờ làm sai kết quả.

**Bước 5 — tìm kiếm.** A* có trọng số, `f = g + 2h`, với `g` = số nước đẩy đã đi. Hàng đợi ưu tiên
là binary heap viết tay (~40 dòng, để private trong `solver.js` — dự án không có dependency).

Trọng số 2 làm nó nhanh hơn hẳn và đổi lại lời giải có thể không ngắn nhất. Chấp nhận được: ta chỉ
cần **một** nước đẩy đúng hướng tới đích, không cần lời giải tối ưu.

**Bước 6 — ngân sách và kết quả.** Dừng khi mở quá `maxNodes` node hoặc quá `maxMs` mili giây, trả
`null`. Giải xong thì trả nước đẩy **đầu tiên** của lời giải: `{ box, dir }` với `box` là toạ độ
thùng ở trạng thái hiện tại — đúng thứ renderer cần để tô sáng.

Trả `null` khi: bàn cờ đã giải xong, màn không có lời giải từ vị trí này (người chơi đã đẩy thùng
vào chỗ chết), hoặc hết ngân sách.

Test cấu hình `maxNodes` tường minh và để `maxMs` là `Infinity`: ngân sách node thì tất định, ngân
sách thời gian thì không.

### 4.2 `web/src/core/solverWorker.js`

Module worker mỏng, chỉ có việc gọi solver và trả kết quả kèm `id` của yêu cầu:

```js
import { solveNextPush } from './solver.js';

self.onmessage = ({ data: { id, snapshot, budget } }) => {
  try {
    self.postMessage({ id, hint: solveNextPush(snapshot, budget) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
```

### 4.3 `web/src/core/hintService.js`

```js
new HintService({ createWorker })   // createWorker được tiêm để test dựng worker giả
requestHint(board) → Promise<{ box, dir } | null>
dispose()
```

- **Snapshot**: chuyển `Board` thành dữ liệu thuần `{ width, height, statics, boxes: [...], player }`
  trước khi gửi. `Board` là class, structured clone không mang theo method — dựng lại từ dữ liệu
  thuần bên trong worker là ranh giới sạch hơn.
- **Một yêu cầu tại một thời điểm**: mỗi yêu cầu có `id` tăng dần. Yêu cầu mới thì promise của yêu
  cầu cũ resolve `null` và kết quả cũ về sau bị bỏ qua.
- **Không dựng được worker**: nếu `new Worker(...)` ném lỗi (trình duyệt không hỗ trợ module worker
  — Firefox mãi bản 114 mới có — hoặc bị sandbox chặn), rơi về chạy solver thẳng trên main thread
  với ngân sách nhỏ hơn (`maxNodes: 20_000`) để lần đơ có giới hạn. Cùng tinh thần "hỏng thì xuống
  nhẹ nhàng" mà `BoardRenderer` dùng cho sprite thiếu và `ProgressStore` dùng cho localStorage bị
  chặn.

> Đây **không** phải để chạy bằng `file://`. Bản web vốn không chạy được từ `file://` vì `import`
> và `fetch` đều bị chặn ở origin đó; nó phải chạy qua http. Fallback này chỉ lo trường hợp
> trình duyệt không dựng được worker.

### 4.4 Hiển thị

`BoardRenderer` thêm hai method:

```js
showHint({ x, y }, dir)   // tô sáng thùng ở (x, y), vẽ mũi tên theo hướng dir
clearHint()
```

Thùng nhận class `.actor--hint`; một phần tử `<i class="actor__hint-arrow">` được gắn **bên trong**
element thùng, xoay theo biến CSS `--hint-rot`. Đặt mũi tên trong element thùng nên nó ăn theo
`transform` sẵn có, không cần logic định vị riêng.

CSS trong `web/styles/board.css`: viền màu accent nhấp nháy (`@keyframes`) cộng mũi tên vẽ bằng
`clip-path` hoặc border triangle — không thêm file ảnh nào.

### 4.5 Luồng điều khiển

`Command.Hint` bị **chặn sớm trong `LevelPlayer.handle`**, ngay cạnh chỗ `Command.Exit` đang được
chặn, tức là **trước** cả kiểm tra `isBusy`. Hint không có animation và không được vào hàng đợi
lệnh: để nó rơi vào vòng chơi thì nó sẽ bị đệm lại và chạy sau một nước đi, sai hoàn toàn.

`LevelPlayer` nhận thêm `hintService` qua constructor và hai hook mới:

| Hook | Khi nào | Ai xử lý |
|---|---|---|
| `onHintStart()` | vừa gửi yêu cầu | `GameFlow` → `Hud.setHintBusy(true)` |
| `onHintDone(found)` | có kết quả | `GameFlow` → `Hud.setHintBusy(false)`, và nếu `!found` thì `Hud.flashNoHint()` |

**Chống kết quả ôi**: trước khi gửi yêu cầu, ghi lại `this.#session.moves`. Khi promise resolve, nếu
`#stopped` bật hoặc `moves` đã khác thì bỏ kết quả — bàn cờ đã đổi, gợi ý không còn đúng nữa.

**Vòng đời gợi ý** — gọi `renderer.clearHint()` ở đúng ba chỗ:

- trong `LevelPlayer.#runOne`, sau mỗi lệnh (mọi nước đi, undo, restart đều xoá gợi ý);
- trong `LevelPlayer.start()`, để màn mới không dính gợi ý của màn cũ;
- trong `LevelPlayer.stop()`.

`Hud` thêm field `#hint`, bind vào `Command.Hint`, và trong `refresh` thì `disabled` khi màn đã giải
xong — giống Undo và Restart. Hai method mới:

- `setHintBusy(on)`: bật thì `disabled = true` và nhãn thành `💡 Thinking…`, tắt thì trả lại
  `💡 Hint` và tính lại `disabled` theo trạng thái session.
- `flashNoHint()`: nhãn thành `💡 No hint` trong 2 giây rồi trả về. Đổi nhãn ngay trên nút chứ
  không thêm ô thông báo mới — ít DOM hơn, và người chơi đang nhìn đúng chỗ đó. Giữ id của
  `setTimeout` trong một field và `clearTimeout` trước khi đặt cái mới, để hai lần bấm liên tiếp
  không khiến timer cũ ghi đè nhãn đang hiện.

`GameFlow` dựng `hintService` một lần và truyền vào mỗi `LevelPlayer` mới; không tạo lại worker mỗi
màn.

## 5. Settings

### 5.1 Markup

Overlay đặt **ngoài** mọi `<section class="screen">`, ở cấp `<body>`:

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

Phải ở ngoài `.screen` vì Settings mở được từ cả menu chính lẫn màn chơi. Overlay "Level complete"
hiện nằm trong `.stage` nên chỉ tồn tại ở màn chơi — không dùng lại chỗ đó được.

`.overlay--modal { position: fixed; z-index: 10; }` trong `web/styles/ui.css`. Luật
`.overlay[hidden] { display: none }` đã có sẵn, dùng luôn.

### 5.2 `web/src/ui/settingsPanel.js`

Cùng khuôn với `levelComplete.js`: constructor nhận `rootEl` và các callback, có `show()` / `hide()`.

```js
new SettingsPanel(rootEl, { onToggleMusic, onToggleSfx, getState })
show() / hide()
refresh()   // vẽ lại nhãn và aria-pressed từ getState()
```

**Nuốt phím khi đang mở.** Panel gắn một listener `keydown` trên `window` ở **capture phase** khi
`show()` và gỡ khi `hide()`:

- `Escape` → đóng panel;
- mọi phím khác → `event.stopPropagation()`.

Bắt buộc phải có. `InputRouter` gắn listener trên `window` ở bubble phase; listener capture trên
cùng `window` chạy trước và `stopPropagation()` chặn được nó. Thiếu bước này thì phím mũi tên vẫn
điều khiển nhân vật sau lưng overlay, và `Escape` sẽ thoát luôn về màn chọn level thay vì đóng panel.

### 5.3 Đổi ở lớp dưới

**`web/src/progress/progressStore.js`** — thay `muted` bằng hai cờ:

- Hình dạng lưu mới: `{ musicOn, sfxOn, collections: [...] }`.
- **Migrate**: save cũ có `muted: true` → `musicOn: false, sfxOn: false`; `muted: false` hoặc thiếu
  → cả hai `true`. Đọc `muted` chỉ để migrate, không ghi lại field đó nữa.
- Xoá getter/setter `muted`, thêm `musicOn` và `sfxOn`.
- Sửa comment đầu file: câu "hình dạng giữ giống bản Unity để hai bên còn so được" không còn đúng —
  Unity đã bị xoá khỏi repo, và ta vừa đổi hình dạng.

**`web/src/audio/audioService.js`** — thay `muted` bằng:

- `get/set musicOn` — set `false` thì `#music.pause()`, set `true` thì play nếu đã `unlock()`;
- `get/set sfxOn` — `play(name)` thoát sớm khi `sfxOn` là `false`;
- `unlock()` chỉ chạy nhạc khi `musicOn`.

### 5.4 Đổi ở lớp trên

| File | Thay đổi |
|---|---|
| `web/index.html` | Xoá `#btn-mute` khỏi HUD và `#btn-menu-mute` khỏi menu. Thêm `#btn-settings` vào thanh nút dưới và `#btn-menu-settings` vào menu chính. Thêm khối overlay ở 5.1. |
| `web/src/ui/mainMenu.js` | Xoá `#muteBtn` và nhánh nhãn "Sound: on/off". Thêm bind `#btn-menu-settings` → `onSettings`. |
| `web/src/main.js` | Xoá `hudMute` và `refreshMuteButton()`. Dựng `panels.settings`, wire hai nút mở. |
| `web/styles/ui.css` | `.toolbar` thêm `flex-wrap: wrap` — thanh nút giờ có 5 nút, màn hẹp phải xuống dòng được. Thêm `.overlay--modal`. |

Nút Settings **không** đi qua `Command`. `Command` là các lệnh trong ván chơi (đi, undo, restart,
thoát, hint) và `Hud` quản những nút phụ thuộc trạng thái session. Settings không phụ thuộc session
và cũng hoạt động ngoài màn chơi, nên nó được wire thẳng trong `main.js` — đúng chỗ nút mute cũ đang
được wire.

Thanh nút dưới sau khi xong:

```
↶ Undo   💡 Hint   ⟳ Restart   ⚙ Settings   ← Select level
```

## 6. Test

Vẫn `node --test`, vẫn không thêm dependency nào, vẫn dùng `tests/fakeDom.mjs`.

**File mới**

| File | Phủ gì |
|---|---|
| `tests/solver.test.mjs` | Màn một thùng: trả đúng nước đẩy đầu tiên. Bàn cờ đã giải: `null`. Thùng đã bị đẩy vào góc chết: `null`. `maxNodes` cực nhỏ: `null` chứ không ném lỗi. Bản đồ ô chết đúng ở một màn có tường. Một màn nhiều thùng mà lời giải bắt buộc phải đi vòng qua khối 2×2 — khẳng định phép cắt tỉa không cắt nhầm. |
| `tests/hintService.test.mjs` | Worker giả: snapshot gửi đi đúng hình dạng; kết quả về đúng promise. Yêu cầu mới đè yêu cầu cũ (promise cũ resolve `null`, kết quả cũ bị bỏ). `createWorker` ném lỗi → rơi về solver đồng bộ và vẫn ra kết quả. |
| `tests/settingsPanel.test.mjs` | Nhãn và `aria-pressed` khớp trạng thái. Bấm toggle gọi callback. `Escape` đóng panel. Khi mở thì phím khác bị `stopPropagation`; khi đóng thì listener đã gỡ. |

**File sửa**

| File | Sửa gì |
|---|---|
| `tests/moveHistory.test.mjs` | Bỏ mọi case redo. |
| `tests/gameSession.test.mjs` | Bỏ mọi case redo. |
| `tests/hud.test.mjs` | `HUD_IDS` bỏ `btn-redo`, thêm `btn-hint`. Sửa case bind, case disabled. Thêm case cho `setHintBusy` và `flashNoHint`. |
| `tests/gameFlow.test.mjs` | Thêm `hintService` giả vào bộ dependency. |
| `tests/mainMenu.test.mjs` | Bỏ case nút mute và nhãn "Sound: on/off"; thay bằng case bind nút Settings. |
| `tests/progressStore.test.mjs` | Bỏ case `muted`, thay bằng `musicOn`/`sfxOn`. Thêm case migrate `muted: true` → hai cờ off; save mới đọc lại đúng. |

Không viết test cho `solverWorker.js` — nó chỉ là một dòng chuyển tiếp, và `Worker` không tồn tại
trong `node --test`. Phần logic thật nằm hết trong `solver.js` và đã có test.

## 7. Rủi ro

**Solver hết ngân sách ở màn khó.** Vài màn Microban cuối (khoảng từ 140 trở đi) có 5–6 thùng trên
không gian rộng và sẽ chạm trần 150.000 node. Khi đó nút hiện `No hint` và không có gì bị hỏng. Đây
là hành vi đã thiết kế, không phải lỗi, và `tests/solver.test.mjs` có case khẳng định đúng điều đó.
Nếu về sau muốn phủ tốt hơn thì nới `maxNodes` hoặc thêm cắt tỉa, không phải đổi kiến trúc.

**Đổi hình dạng dữ liệu lưu.** Người chơi đang có save cũ sẽ đi qua nhánh migrate ở 5.3. Nhánh đó
phải có test, vì hỏng nó thì người chơi mất tiến trình — mà tiến trình là thứ duy nhất game này lưu.
