# Thiết kế: Settings dạng sheet, thêm Tutorial và Restart

Ngày: 2026-08-04

## 1. Mục tiêu

Dựng lại overlay Settings theo mẫu ảnh người dùng gửi: một tấm sheet tối, header có tiêu đề và
nút `✕`, các hàng ngăn nhau bằng đường kẻ mảnh, mỗi hàng có icon bên trái. Ba việc:

1. **Đổi dáng hình** — hai công tắc âm thanh hiện tại chuyển từ hai nút chữ xếp dọc
   (`Music: on` / `Sound effects: on`) thành một hàng đôi có icon và trạng thái gạch chéo.
2. **Thêm Tutorial** — một hàng dẫn sang khung nhìn thứ hai trong cùng overlay, chứa luật chơi,
   chú giải ô và bảng phím.
3. **Thêm Restart** — một nút ở đáy sheet, chỉ hiện khi đang có màn chơi.

Thành công khi: mở Settings từ menu chính thấy hai hàng (âm thanh, Tutorial) và **không** thấy
Restart; mở lúc đang chơi thì thấy đủ ba; bấm Tutorial sang được trang hướng dẫn và `‹` hoặc `Esc`
quay lại; bấm Restart thì màn chơi lại từ đầu và panel tự đóng; `npm test` xanh.

Chữ trên giao diện **giữ tiếng Anh**. Spec này viết tiếng Việt, theo đúng lệ của
[2026-08-03-hint-settings-design.md](2026-08-03-hint-settings-design.md).

## 2. Quyết định chốt

| Quyết định | Chốt | Lý do |
|---|---|---|
| Phạm vi so với ảnh mẫu | Dáng hình + Tutorial + Restart. **Bỏ Language và Country.** | Language cần i18n toàn game — rút mọi chuỗi tiếng Anh ra file dịch, thêm store cho ngôn ngữ đã chọn. Đó là dự án riêng, không phải một hàng trong Settings. Country trong game mẫu phục vụ bảng xếp hạng, ở đây không có gì để phục vụ. |
| Restart khi mở từ menu | Ẩn hẳn hàng đó | Ở menu chính không có màn nào để chơi lại. Bày một nút chết ra rồi làm nó mờ đi là mời người dùng bấm vào chỗ không có gì. |
| Ý nghĩa Restart | Chơi lại **màn hiện tại** | Trùng nghĩa với `⟳ Restart` trên thanh nút và phím `R` đang có. Đổi nó thành "xoá toàn bộ tiến trình" là đặt hai nghĩa khác nhau lên cùng một chữ trong cùng một game. |
| Nút `⟳ Restart` trên thanh nút | Giữ nguyên | Sokoban chơi lại rất nhiều. Chôn thao tác đó sau hai lần bấm là bước lùi. Cả hai gọi cùng một đường. |
| Cách vẽ trạng thái công tắc | Bật = sáng màu accent; tắt = mờ + vạch chéo | Ảnh mẫu dùng vòng tròn gạch chéo xanh lá, nghĩa hoàn toàn dựa vào màu — người mù màu đỏ-lục không đọc được, và vòng gạch chéo màu xanh lá vẫn dễ đọc nhầm thành "cấm". Vạch chéo = "không" là quy ước phổ thông, và còn đọc được cả khi đã mù màu. |
| Nội dung Tutorial | Một trang chữ tĩnh | Không có trạng thái nào để quản, nên không có gì để hỏng. Nhiều trang lật hay màn tập tương tác đều đã cân nhắc và loại: cái đầu thêm state chỉ để chia nhỏ vài câu, cái sau phải đụng vào `LevelPlayer` và vòng đời màn chơi. |
| Vẽ vạch chéo | `::after` xoay bằng CSS | Không phụ thuộc vào font emoji của máy. `🔇` render khác nhau trên mỗi hệ, và trên Windows nó là emoji màu không nhuộm theo `color` được. |

## 3. Cấu trúc

Một overlay, hai khung nhìn. Chỉ một khung hiện tại một thời điểm.

```
KHUNG LIST (mặc định)              KHUNG TUTORIAL
┌────────────────────────┐         ┌────────────────────────┐
│      Settings       ✕  │         │  ‹  How to play     ✕  │
├────────────────────────┤         ├────────────────────────┤
│  🔊 Sounds   🎵 Music  │         │  Push every box onto   │
├────────────────────────┤         │  a goal. You can only  │
│  📖 Tutorial        ›  │         │  push — never pull.    │
├────────────────────────┤         │                        │
│     [  Restart  ]      │         │  ▨ wall  ○ goal        │
└────────────────────────┘         │  ▣ box   ◉ box on goal │
   ↑ ẩn khi không chơi             │                        │
                                   │  ←↑→↓ / WASD  move     │
                                   │  U undo    H hint      │
                                   │  R restart Esc exit    │
                                   └────────────────────────┘
```

### Markup

Thay toàn bộ ruột của `#settings` trong `web/index.html` (hiện là `web/index.html:67-76`):

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
          <span class="switch__label">Sounds</span>
        </button>
        <button class="switch" id="btn-music" type="button" aria-pressed="true">
          <span class="switch__icon" aria-hidden="true">🎵</span>
          <span class="switch__label">Music</span>
        </button>
      </div>

      <button class="row row--nav" id="btn-tutorial" type="button">
        <span class="row__icon">📖</span>
        <span class="row__label">Tutorial</span>
        <span class="row__chevron" aria-hidden="true">›</span>
      </button>

      <div class="sheet__foot" id="row-restart">
        <button class="btn btn--big" id="btn-settings-restart" type="button">Restart</button>
      </div>
    </div>

    <div class="sheet__view" id="settings-tutorial" hidden>
      <p>Push every box onto a goal. You can only push a box — never pull it.</p>
      <ul class="legend"><!-- bốn ô mẫu, xem mục dưới --></ul>
      <dl class="keys"><!-- Arrows/WASD move · U undo · H hint · R restart · Esc exit --></dl>
    </div>
  </div>
</div>
```

Ba id cũ giữ nguyên tên: `#btn-music`, `#btn-sfx`, `#btn-settings-close`. Phần nối dây ở
`web/src/main.js` cho hai công tắc do đó không phải đổi.

Nhãn đổi từ `Sound effects` thành **Sounds** cho vừa nửa hàng. Trợ năng không mất gì: `refresh()`
đặt `aria-label` đầy đủ (`Sound effects: on` / `off`) lên nút, nên trình đọc màn hình vẫn nghe
nguyên chữ cũ.

### Chú giải ô trong Tutorial

Bốn ô mẫu dựng bằng **chính class của bàn cờ** — `.tile--wall`, `.tile--goal`, và
`.actor--box > .actor__face` — nên chú giải luôn khớp với thứ người chơi thấy thật, kể cả khi
sau này đổi màu trong `board.css`.

Hai điều kiện phải xử lý, nếu không sẽ vỡ layout:

- `.tile` và `.tile--goal::before` đọc `--cell` và `--stroke`, mà hai biến này khai báo trên
  `.board` chứ không phải `:root`. Ô mẫu nằm ngoài bàn cờ nên phải tự khai báo lại chúng
  (`--cell: 30px` và công thức `--stroke` y như trong `board.css`).
- `.actor` là `position: absolute; top: 0; left: 0` — nó sống được là nhờ `.board__actors` bọc
  ngoài. Trong chú giải, mỗi ô mẫu tự làm khung: `.legend__cell { position: relative }`, cộng một
  luật ghi đè `.legend__cell .actor { transition: none }` để ô mẫu không thừa hưởng transition
  của quân đang chạy.

## 4. `SettingsPanel`

Giữ nguyên lối tiêm phụ thuộc đang có, thêm một callback và một trường trạng thái:

```js
new SettingsPanel(rootEl, {
  onToggleMusic,
  onToggleSfx,
  onRestart,                                   // mới
  getState,    // → { musicOn, sfxOn, playing } // `playing` là mới
  keyTarget,
})
```

| Method | Hành vi |
|---|---|
| `show()` | Luôn mở ở khung list, kể cả lần trước đóng lúc đang xem Tutorial. Vẫn `refresh()` rồi bỏ `hidden`, vẫn chỉ gắn listener phím một lần. |
| `hide()` | Như cũ. |
| `refresh()` | Đặt `aria-pressed` và `aria-label` cho hai công tắc; ẩn/hiện `#row-restart` theo `playing`. Trạng thái nhìn thấy được vẽ từ `aria-pressed` bằng CSS, không phải bằng một class riêng — một nguồn sự thật. |
| `onKeyDown(event)` | Vẫn nuốt mọi phím ở capture phase. `Escape`: đang ở Tutorial thì lùi về list, ở list thì đóng panel. |

Hai method riêng `#showTutorial()` / `#showList()` lo phần đổi khung: bật/tắt `hidden` của hai
`.sheet__view`, đổi chữ `#settings-title` giữa `Settings` và `How to play`, và bật/tắt `hidden`
của nút `‹`.

Hàng Restart bấm → gọi `onRestart()` rồi `hide()`. Đóng panel là bắt buộc: nếu không, người chơi
nhìn màn đã reset qua một tấm overlay còn nằm đó.

## 5. Nối dây

Ở `web/src/main.js:67-71`, chỗ dựng `SettingsPanel`, thêm hai mục:

```js
onRestart: () => flow.retryLevel(),
getState: () => ({
  musicOn: audio.musicOn,
  sfxOn: audio.sfxOn,
  playing: document.body.dataset.screen === 'play',
}),
```

`flow.retryLevel()` đã có sẵn — `LevelComplete` đang dùng chính nó cho nút `Play again`.

`playing` đọc từ `document.body.dataset.screen`, đúng cái mà `GameFlow` ghi ở ba chỗ chuyển màn
(`gameFlow.js:44`, `:50`, `:86`). Một nguồn sự thật, không thêm cờ song song để lệch nhau.

`flow` khai báo **sau** `panels` trong `main.js`, nhưng `onRestart` chỉ chạy lúc người dùng bấm
nên `const flow` đã khởi tạo xong từ lâu — cùng kiểu closure mà `onContinue` và `onSelect` đang
dùng ngay trên đó.

## 6. CSS

Thêm vào `web/styles/ui.css`. Không sửa `.panel` gốc: menu chính và overlay thắng màn đang dùng
chung nó, đổi ở đó là đổi cả ba chỗ.

| Class | Việc |
|---|---|
| `.panel--sheet` | Bỏ `text-align: center` và padding ngang của `.panel`, để hàng chạy sát mép và đường kẻ ngăn kéo hết chiều rộng. Đặt `width: min(360px, 92vw)`. |
| `.sheet__head` | Grid ba cột `auto 1fr auto`, tiêu đề canh giữa. Cột trái luôn chiếm chỗ dù nút `‹` đang ẩn, nếu không tiêu đề sẽ nhảy ngang khi đổi khung. |
| `.sheet__view` | `max-height: 70vh; overflow-y: auto`. Khung Tutorial cao hơn khung list, và trên màn xoay ngang nó tràn nếu không chặn. |
| `.row` | Grid `auto 1fr auto` (icon, nhãn, chevron), `border-top: 1px solid var(--panel-line)`. |
| `.row--pair` | Chia đôi cho hai công tắc. |
| `.switch` | Bật: `color: var(--accent)`. Tắt: `opacity: 0.45` + `::after` là một vạch `2px` xoay `-45deg` đè qua icon. Chọn theo `[aria-pressed="false"]` nên trạng thái CSS và trạng thái trợ năng không thể lệch nhau. |
| `.legend`, `.legend__cell`, `.keys` | Chú giải ô và bảng phím trong Tutorial. |

## 7. Test

Mở rộng `web/tests/settingsPanel.test.mjs` (đang 10 test), vẫn `node --test`, vẫn `fakeDom.mjs`,
không thêm dependency.

| Test | Khẳng định |
|---|---|
| Mở ra là ở khung list | Kể cả sau khi lần trước đóng lúc đang xem Tutorial. |
| `#btn-tutorial` sang khung Tutorial | `#settings-tutorial` hiện, `#settings-list` ẩn, tiêu đề đổi, nút `‹` hiện. |
| `‹` lùi về list | Ngược lại tất cả những điều trên. |
| `Escape` ở Tutorial lùi về list | Panel **không** đóng. |
| `Escape` ở list đóng panel | Như hành vi cũ. |
| `playing: false` thì `#row-restart` ẩn | Kiểm ở cả `show()` lẫn `refresh()`. |
| `playing: true` thì hiện | |
| Bấm Restart gọi `onRestart` **và** đóng panel | Hai khẳng định riêng, không gộp. |
| Công tắc đổi `aria-pressed` theo state trả về | Cả hai chiều bật→tắt và tắt→bật. |

`fakeDom` đã đủ dùng: có `hidden`, `querySelector` theo `#id` và `.class`, `dispatch`. Không phải
thêm gì.

## 8. Đã cân nhắc và loại

| Bỏ | Vì sao |
|---|---|
| Language + Country | Cần i18n toàn game. Dự án riêng, spec riêng. |
| Công tắc trượt kiểu điện thoại | Lạc với phần còn lại của game — hiện toàn nút vuông viền mảnh — và tốn khá nhiều CSS cho đúng một thứ đã có cách vẽ rẻ hơn. |
| Tutorial nhiều trang lật | Thêm trạng thái trang chỉ để chia nhỏ vài câu chữ. |
| Giam tiêu điểm bàn phím trong overlay (focus trap) | Đã ghi nhận là một minor từ đợt trước và cố ý để lại. Không mở rộng phạm vi ở đây. |
| Xoá tiến trình đã lưu | Không ai yêu cầu, và là thao tác không thể hoàn tác. |
