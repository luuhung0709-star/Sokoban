# Thiết kế: Sokoban bản web (HTML + CSS + JavaScript thuần)

Ngày: 2026-07-30

## 1. Mục tiêu

Viết lại game Sokoban bằng HTML + CSS + JavaScript thuần, **thay hẳn bản Unity**. Bản web phải đủ
tính năng bản Unity đang có: luật chơi chuẩn, 155 màn Microban, undo/redo không giới hạn, màn hình
chọn màn có khoá tuần tự và lưu tiến độ, animation di chuyển mượt, âm thanh, và một level editor cho
dev.

Thành công khi: mở link GitHub Pages, chơi trọn Microban từ màn 1 tới màn 155, tiến độ còn nguyên sau
khi đóng trình duyệt, `npm test` xanh, và không cần Unity để chạy hay sửa game nữa.

Bản Unity **vẫn nằm trong repo** làm nguồn art, âm thanh và dữ liệu màn. Khi bản web chạy ổn thì mới
tính chuyện xoá — không xoá trong phạm vi spec này.

## 2. Quyết định nền tảng

| Quyết định | Chốt | Lý do |
|---|---|---|
| Nền kỹ thuật | HTML + CSS + JS thuần, ES module | Không framework, không build step. Game lưới nhỏ không cần gì hơn. |
| Cách chạy | Qua http (local server + GitHub Pages) | Cho phép dùng `import` và `fetch`. `file://` chặn cả hai. |
| Vị trí code | Thư mục `web/` trong repo hiện tại | Giữ Unity làm nguồn asset; Pages deploy bằng GitHub Actions. |
| Test | `node --test` | Có sẵn trong Node, không cài thêm. `package.json` chỉ để chạy test — game không có build step. |
| Vẽ bàn cờ | Lưới tĩnh + lớp actor tuyệt đối | Xem mục 6.2. |
| Art | Lai: nền/tường bằng CSS, còn lại bằng sprite | Xem mục 6.1. |
| Bố cục | Thanh thông tin trên + hàng nút dưới | Xem mục 8. |

HTML/CSS thuần không chạy được luật đẩy hộp, undo hay chọn màn — CSS-only chỉ làm được kiểu
checkbox-hack, không kham nổi 155 màn. Nên JavaScript lo phần logic, HTML/CSS lo phần hiển thị.

**Không làm bản mobile.** Không có điều khiển cảm ứng, không có layout co theo màn hình điện thoại.
Game nhắm desktop, bàn phím và chuột.

## 3. Cấu trúc thư mục

```
web/
  index.html              khung trang + các panel
  styles/
    base.css              biến màu, reset, typography
    board.css             tile CSS, lớp actor, animation
    ui.css                menu, chọn màn, HUD, panel thắng màn
  src/
    core/
      direction.js        4 hướng + vector
      board.js            statics + vị trí người + tập hộp + isSolved
      moveResolver.js     resolve / apply / revert
      moveHistory.js      stack undo + nhánh redo
      gameSession.js      board + history + bộ đếm + sự kiện
    levels/
      sokobanChars.js     bảng ký tự
      parseMicroban.js    text -> danh sách màn
      levelValidator.js   kiểm tra màn hợp lệ
      microban.json       155 màn (sinh ra, có commit)
    view/
      boardRenderer.js    dựng lưới tĩnh + actor
      moveAnimator.js     tween transform, đệm input
    input/
      inputRouter.js      bàn phím + nút bấm -> lệnh
    ui/
      gameFlow.js         điều phối panel
      mainMenu.js · levelSelect.js · hud.js · levelComplete.js
    progress/
      progressStore.js    localStorage
    audio/
      audioService.js
    main.js               bootstrap
  assets/
    art/                  sprite copy từ Assets/Art/
    audio/                copy từ Assets/Audio/ (kèm License.txt)
  editor/
    index.html · editor.js    level editor cho dev, không deploy
  tools/
    import-microban.mjs       .txt -> microban.json, chạy tay bằng node
  tests/
    *.test.mjs
  package.json                chỉ để `npm test`
```

**Nguyên tắc phân lớp**: `core/` và `levels/` là JS thuần, **không đụng DOM, không đụng
`localStorage`, không đụng `Audio`**. Nhờ vậy `node --test` chạy được chúng mà không cần trình duyệt
giả lập — đúng như bản Unity tách EditMode test khỏi scene. `view/`, `ui/`, `input/`, `audio/`,
`progress/` được phép đụng API trình duyệt và **không** được `core/` import ngược lại.

## 4. Lõi luật chơi

Port thẳng từ C#, giữ nguyên tên module và ranh giới trách nhiệm.

| Module | Vai trò | Phụ thuộc |
|---|---|---|
| `direction.js` | Bốn hướng, mỗi hướng có `{dx, dy}` | không |
| `board.js` | `statics[y][x]` (Wall/Floor/Goal) dựng một lần lúc load, không đổi trong màn · `player {x,y}` · `boxes` · `isSolved` | direction |
| `moveResolver.js` | Hàm thuần `resolve(board, dir) → MoveResult`; `apply(board, move)`; `revert(board, move)` | board |
| `moveHistory.js` | Stack undo + nhánh redo | — |
| `gameSession.js` | Gói board + history + `moves`/`pushes`, phát sự kiện `change` | tất cả trên |

**`boxes` là `Set` chứa khoá chuỗi `"x,y"`**, không phải `Set` chứa object toạ độ: JS so sánh object
theo tham chiếu nên `Set` object sẽ không nhận ra hai toạ độ bằng nhau. Đây là khác biệt bắt buộc so
với `HashSet<Vector2Int>` bên C#.

`MoveResult` là object thường: `{ blocked, push, from, to, boxFrom, boxTo }`. Trường `blocked` cho
biết nước đi bị chặn; `push` cho biết có đẩy hộp không; các toạ độ để lớp hiển thị biết chính xác cái
gì đã đi từ đâu tới đâu.

### 4.1 Luật chơi

- Người chơi đi được vào ô Floor hoặc Goal không có hộp.
- Đẩy được khi ô kế tiếp theo cùng hướng là Floor hoặc Goal và không có hộp khác — nghĩa là **không
  đẩy được hai hộp liền nhau**, và không đẩy hộp vào tường.
- Thắng khi mọi hộp đều nằm trên ô đích. Số hộp luôn bằng số đích (validator bảo đảm).
- `isSolved` **luôn tính lại từ bàn cờ**, không đếm tăng giảm — đẩy một hộp đang đúng đích ra ngoài
  thì mất trạng thái thắng.
- Undo đảo ngược nước đi cuối: lùi người chơi, và nếu là nước đẩy thì kéo hộp về. Redo đẩy lại từ
  nhánh đã undo. Đi một nước mới thì **xoá nhánh redo**.

## 5. Dữ liệu màn chơi

### 5.1 Định dạng ký tự (chuẩn Sokoban)

| Ký tự | Ý nghĩa | | Ký tự | Ý nghĩa |
|-------|---------|-|-------|---------|
| `#`   | Tường   | | `$`   | Hộp     |
| ` `   | Nền trống | | `*`   | Hộp trên đích |
| `@`   | Người chơi | | `.`   | Ô đích |
| `+`   | Người chơi trên đích | | | |

### 5.2 Từ .txt sang JSON

`tools/import-microban.mjs` đọc [Assets/Levels/microban.txt](../../../Assets/Levels/microban.txt)
đang có trong repo và sinh ra `web/src/levels/microban.json`:

```json
{ "collectionName": "Microban",
  "levels": [ { "name": "1", "width": 7, "height": 5, "rows": ["#######", "#. $ @#", …] } ] }
```

Chạy **tay** một lần, kết quả commit vào repo. Game lúc chạy chỉ `fetch` một file JSON, không parse
text — parse 155 màn mỗi lần mở game là việc thừa.

Đặc điểm file nguồn (đã kiểm chứng khi làm bản Unity): các khối cách nhau bằng dòng trống; khối đầu
là header `Title:` / `Description:` / `Author:` / `Email:` / `Website:` và **không phải màn chơi**;
mỗi khối màn có các hàng lưới trước rồi dòng `Title: <n>` ở cuối; các hàng trong cùng một màn dài ngắn
khác nhau nên phải pad bằng dấu cách cho bằng hàng dài nhất. Phân biệt khối màn với header: khối màn
có ít nhất một hàng chỉ gồm 7 ký tự ở bảng 5.1 và chứa `@` hoặc `+`.

`parseMicroban.js` vẫn là module riêng có test — level editor dùng lại nó cho nút Import .txt. Màn nào
sai định dạng thì ghi lỗi kèm số dòng và **bỏ qua riêng màn đó**, phần còn lại vẫn import bình thường.

`levelValidator.js` kiểm tra: đúng một người chơi, số hộp bằng số đích, tường bao kín vùng chơi, hộp
và người nằm trong vùng chơi. **Không** kiểm tra màn có giải được — viết solver Sokoban là bài toán
riêng, nằm ngoài phạm vi spec này.

## 6. Hiển thị

### 6.1 Art — lai CSS và sprite

| Vai trò | Cách vẽ | Nguồn |
|---|---|---|
| Nền | CSS, hai tông xen kẽ theo `(x + y) % 2` | — |
| Tường | CSS, gradient + inset shadow | — |
| Ô đích | sprite | `Assets/Art/Markers/mark_o.png` |
| Hộp chưa vào đích | sprite + **dấu X chồng lên** | `Assets/Art/Modern/box.png` + `Markers/mark_x.png` |
| Hộp trên đích | sprite, không có dấu X | `Assets/Art/Modern/box_on_goal.png` |
| Người chơi | sprite, đổi theo hướng đi | `Assets/Art/Modern/player_{up,down,left,right}.png` |

Nền và tường lặp lại nhiều nhất nên để CSS lo: luôn sắc nét ở mọi cỡ ô, đổi tông màu chỉ cần sửa một
biến. Những thứ có tính cách thì giữ sprite.

**Ô đích dùng `mark_o.png` chứ không phải `goal.png`.** Bản Unity đã chuyển sang vòng tròn đỏ —
[MarkGenerator.cs](../../../Assets/Editor/MarkGenerator.cs) trỏ `GoalTile` sang `mark_o`. Bản web theo
trạng thái mới này; `goal.png` là art cũ, không copy sang.

Người chơi đổi sprite theo hướng đi — bộ Modern có sẵn 4 hướng, bản Unity chưa dùng tới.

Art được **copy** vào `web/assets/art/`, không tham chiếu ngược vào `Assets/`: GitHub Pages chỉ deploy
`web/`, và bản web phải chạy được kể cả khi sau này xoá project Unity.

### 6.2 Cấu trúc DOM

Hai lớp chồng nhau trong một khung `.board`:

```html
<div class="board" style="--cols:20; --rows:12; --cell:44px">
  <div class="statics">   <!-- CSS Grid, dựng đúng một lần khi load màn -->
    <i class="tile floor-a"></i> <i class="tile wall"></i> <img class="tile goal" …>
  </div>
  <div class="actors">    <!-- con position:absolute, chỉ đụng khi có nước đi -->
    <div class="box" style="transform:translate(264px,132px)"><img …><img class="mark" …></div>
    <div class="player"><img src="player_down.png"></div>
  </div>
</div>
```

Phần tĩnh vẽ một lần, phần động tách riêng — chính là kiến trúc Tilemap tĩnh + GameObject động của
bản Unity, nên port sang gần như một-đối-một.

Hai hướng đã cân nhắc và loại:

- *Render lại cả lưới mỗi nước đi*: code ngắn nhất, nhưng element bị thay mới nên không trượt được,
  mà spec này yêu cầu có animation. Màn lớn còn phải dựng lại ~500 node mỗi bước.
- *Canvas 2D*: chủ động nhất về animation, nhưng vứt bỏ toàn bộ phần CSS, và menu với chọn màn vẫn
  phải là DOM — thành ra phải nuôi hai hệ thống hiển thị song song.

### 6.3 Kích thước ô

`--cell` do JS tính khi load màn và khi cửa sổ đổi kích thước, lấy từ kích thước màn so với vùng hiển
thị còn lại, **kẹp trong khoảng 20–64px**. Đây là bản thay thế cho `CameraFitter`: màn nhỏ không lọt
thỏm, màn 30×17 không tràn ra ngoài. Mọi kích thước khác trong CSS đọc theo biến này, không có con số
cứng rải rác.

### 6.4 Animation

`moveAnimator.js` đổi `transform` của actor, CSS lo phần còn lại qua `transition: transform .12s
linear` — cùng thời lượng với bản Unity.

- Kết thúc bắt bằng `transitionend`, kèm timeout dự phòng để không kẹt vĩnh viễn nếu sự kiện rơi.
- Trong lúc tween chạy, input tiếp theo được **đệm tối đa 1 nước** rồi thực thi ngay khi tween xong.
- Undo/redo dùng cùng animation, hướng ngược lại.
- Load màn và restart gắn class tắt transition, để actor không "bay" từ vị trí màn cũ sang.
- Hộp vào/ra khỏi đích thì đổi `src` và bật/tắt lớp dấu X ở **cuối** animation, không phải lúc bắt đầu.

## 7. Điều khiển

`inputRouter.js` gom mọi nguồn input thành một luồng lệnh. Phím giữ nguyên như bản Unity:

| Phím | Lệnh |
|---|---|
| Mũi tên / WASD | Đi theo hướng |
| `U` | Undo |
| `Y` | Redo |
| `R` | Chơi lại màn |
| `Esc` | Về màn hình chọn màn |

Nút trên thanh dưới làm đúng bốn lệnh sau, bấm được bằng chuột.

**Giữ phím**: router theo dõi phím đang được giữ và tự phát nước tiếp ngay khi animation xong, **không**
dựa vào auto-repeat của hệ điều hành — auto-repeat trễ khoảng 500ms ở nhịp đầu, cầm phím sẽ khựng.

Mũi tên phải `preventDefault` để không cuộn trang.

## 8. Luồng game và UI

Một trang `index.html`, các panel là `<section>` bật/tắt qua thuộc tính `data-screen` trên `<body>`.
`gameFlow.js` giữ màn hình hiện tại và điều phối.

- **MainMenu** — Chơi tiếp (vào `lastPlayedIndex`), Chọn màn, bật/tắt tiếng, hướng dẫn phím ngắn.
- **LevelSelect** — lưới 155 nút số màn; màn đã qua có dấu tick và số bước tốt nhất; màn chưa mở khoá
  hiển thị mờ và `disabled`. Mở khoá **tuần tự**: qua màn *n* mới mở màn *n+1*; màn đầu tiên luôn mở.

**Quy ước đánh số**: mọi chỉ số trong code và trong tiến độ (`index`, `lastPlayedIndex`) đếm **từ 0**,
giống bản Unity. Số hiển thị cho người chơi lấy từ trường `name` của màn (Microban đánh `"1"`–`"155"`),
không phải từ chỉ số cộng một — bộ màn khác có thể đặt tên không phải số.
- **Playing** — thanh trên (tên màn · số bước · số lần đẩy · nút tắt tiếng), bàn cờ ở giữa, hàng nút
  dưới (Undo · Redo · Chơi lại · Chọn màn). Bố cục này giữ trọn chiều ngang cho bàn cờ, quan trọng vì
  màn rộng tới 30 ô.
- **LevelComplete** — overlay trên bàn cờ: số bước lượt này, kỷ lục cũ nếu có, nút Màn tiếp / Chơi lại
  / Chọn màn. Ở màn cuối, nút Màn tiếp bị ẩn và panel hiện lời chúc mừng hoàn thành bộ màn.

Không có màn hình tạm dừng riêng — `Esc` làm đúng việc của nút Chọn màn.

## 9. Lưu tiến độ

`progressStore.js` ghi JSON vào `localStorage`, key `sokoban.progress`. **Giữ nguyên shape của bản
Unity** để sau này còn đối chiếu được:

```json
{ "muted": false,
  "collections": [
    { "name": "Microban", "lastPlayedIndex": 13,
      "levels": [ { "index": 0, "completed": true, "bestMoves": 33, "bestPushes": 9 } ] } ] }
```

Kỷ lục chỉ ghi đè khi tốt hơn; lần đầu hoàn thành thì ghi thẳng. JSON hỏng hoặc thiếu trường →
**reset về rỗng kèm `console.warn`**, không ném lỗi làm chết game.

## 10. Âm thanh

`audioService.js` dùng lại nguyên bộ [Assets/Audio/](../../../Assets/Audio/): `step.ogg`, `push.ogg`,
`box_on_goal.ogg`, `win.ogg`, `undo.ogg` và `music_loop.mp3`, copy sang `web/assets/audio/` **kèm
`License.txt`**.

SFX phát chồng được bằng cách clone node audio — bấm phím nhanh không được nuốt tiếng. Trình duyệt
chặn autoplay trước thao tác đầu tiên, nên nhạc nền chỉ bắt đầu từ lần bấm đầu tiên chứ không phát
ngay lúc load. Trạng thái tắt tiếng lưu chung với tiến độ (`muted`).

## 11. Level editor cho dev

`web/editor/index.html` — trang riêng, mở qua local server, **không** nằm trong bản deploy.

- Bảng cọ: tường · nền · đích · hộp · người · xoá. Đổi được kích thước lưới.
- Nút **Kiểm tra** dùng `levelValidator.js`, hiện danh sách lỗi cụ thể.
- Nút **Import .txt** dùng `parseMicroban.js`.
- Nút **Xuất JSON** để dán vào `microban.json` hoặc tải về thành file.

Đây là bản thay thế cho `LevelCollectionWindow` bên Unity.

## 12. Test

`node --test`, chạy qua `npm test`. Nhắm vào lõi và parser:

- **moveResolver** — đi vào ô trống, đi vào tường (bị chặn), đẩy hộp hợp lệ, đẩy hộp vào tường (bị
  chặn), đẩy vào hộp khác (bị chặn).
- **board** — thắng khi mọi hộp phủ hết đích; đẩy một hộp đang đúng đích ra ngoài thì mất trạng thái
  thắng.
- **moveHistory** — undo khôi phục đúng trạng thái trước đó kể cả nước đẩy; undo hết về đầu màn trùng
  khớp trạng thái ban đầu; redo lặp lại đúng nước đã undo; đi nước mới thì xoá nhánh redo.
- **parseMicroban** — đọc đúng cả 7 ký tự, pad hàng ngắn, bỏ qua khối header, báo lỗi có số dòng với
  đầu vào hỏng.
- **progressStore** — mở khoá tuần tự, ghi kỷ lục chỉ khi tốt hơn, JSON hỏng thì reset. Dùng một
  `localStorage` giả cắm vào lúc test, không cần trình duyệt.
- **Hồi quy** — parse toàn bộ 155 màn Microban và khẳng định mọi màn hợp lệ (đúng một người chơi, số
  hộp bằng số đích); chạy lời giải tự giải tay của 3–5 màn đầu qua `gameSession` và kiểm tra kết thúc
  ở trạng thái thắng.

Lớp hiển thị không có test tự động — kiểm bằng mắt trên trình duyệt.

## 13. Xử lý lỗi

- `microban.json` tải lỗi → LevelSelect hiện thông báo thay vì trắng trang.
- Thiếu file art → ô placeholder màu hồng kèm `console.error`, không im lặng bỏ trống.
- `localStorage` hỏng hoặc bị chặn → tiến độ về rỗng kèm cảnh báo, game vẫn chơi được (chỉ là không
  nhớ được gì).
- Màn sai định dạng lúc import → ghi lỗi kèm số dòng, bỏ qua riêng màn đó.
- Bộ màn rỗng → LevelSelect hiện thông báo.

## 14. Deploy

GitHub Actions build Pages từ thư mục `web/`, **loại `editor/`, `tests/`, `tools/`, `package.json`**
khỏi bản deploy. Không có bước build — workflow chỉ copy file tĩnh.

Chạy lúc dev: bất kỳ static server nào (`npx serve web`), không double-click `index.html` vì `file://`
chặn ES module và `fetch`.

## 15. Ngoài phạm vi

Không làm trong spec này: điều khiển cảm ứng và layout mobile · solver tự động hay gợi ý nước đi ·
sinh màn ngẫu nhiên · bảng xếp hạng online · đa ngôn ngữ · xoá project Unity khỏi repo · bộ màn khác
ngoài Microban.

## 16. Mốc triển khai

1. Dựng `web/` + `package.json`, port lõi (`direction`, `board`, `moveResolver`, `moveHistory`,
   `gameSession`) kèm test.
2. `parseMicroban` + `levelValidator` kèm test, chạy `import-microban.mjs` sinh `microban.json`, test
   hồi quy 155 màn.
3. Copy art và audio sang `web/assets/`, viết CSS tile (nền, tường) và `boardRenderer` — vẽ được một
   màn tĩnh trên trình duyệt.
4. `inputRouter` + `moveAnimator` — đi, đẩy, animation, đệm input, phát hiện thắng màn.
5. Undo / redo / restart + HUD đếm bước và đẩy.
6. `gameFlow`, MainMenu, LevelSelect, LevelComplete, `progressStore`.
7. `audioService` và nút tắt tiếng.
8. Level editor.
9. GitHub Actions deploy Pages, chỉnh sửa cuối.
