# Thiết kế: Tạm dừng nhạc nền khi người chơi rời đi

Ngày: 2026-08-04

## 1. Mục tiêu

Nhạc nền hiện chạy mãi. `AudioService` đặt `loop = true` (`web/src/audio/audioService.js:32`) và
`unlock()` bật nó ở thao tác đầu tiên, sau đó không có gì dừng nó lại ngoài công tắc trong
Settings. Một tab bị bỏ quên vì thế kêu vô hạn — đúng chuyện đã xảy ra sáng nay: một server
dev còn sót của phiên làm việc trước phục vụ `web/` ở cổng 8000, tab game vẫn mở, và nhạc phát
trong lúc người dùng đang làm việc ở cửa sổ khác.

Thành công khi: chuyển sang ứng dụng khác hoặc sang tab khác thì nhạc im trong vòng một nhịp;
quay lại thì nhạc phát tiếp; và không có ca nào nhạc tự bật lên khi người chơi đã tắt nó.

Chữ trên giao diện không đổi. Spec viết tiếng Việt, theo lệ của
[2026-08-04-settings-sheet-design.md](2026-08-04-settings-sheet-design.md).

## 2. Quyết định chốt

| Quyết định | Chốt | Lý do |
|---|---|---|
| Mốc dừng | `visibilitychange` **và** `blur`/`focus` của window | Chỉ nghe `visibilitychange` thì không cứu được đúng ca đã gây khó chịu: khi alt-tab từ Chrome sang VS Code, tab game vẫn là tab đang mở của cửa sổ nên `document.hidden` vẫn `false` và sự kiện không bắn. Phải có `blur` mới bắt được. |
| Giá phải trả của `blur` | Chấp nhận | Ai để game ở màn hình phụ rồi gõ phím bên màn hình chính sẽ bị cắt nhạc. Blur cũng bắn khi mở DevTools ở cửa sổ riêng, bấm omnibox (Ctrl+L), hoặc popup extension — tất cả đều tắt nhạc. Nhưng `pause()`/`play()` giữ `currentTime`, nên người chơi chỉ nghe khoảng trống, không phải track bắt đầu lại từ đầu. Đổi lại là im lặng khi rời đi — thứ người dùng vừa yêu cầu. Ghi lại ở đây để sau này ai thấy lạ thì biết là cố ý, không phải lỗi. |
| Hiếm: chuyển tab khi blur | **Chấp nhận, không sửa** | Cửa sổ blur nên `suspend()` chạy, `#suspended` thành true; nhưng khi cửa sổ vẫn mất OS focus, người dùng chuyển tab trong cửa sổ đó, bắn `visibilitychange` với `hidden = false` nên gọi `resume()` — nhạc phát mặc dù cửa sổ không có focus. Rất khó xảy ra vì chuyển tab bình thường phải focus cửa sổ trước, bắn `focus` → `resume()` trước sự kiện `visibilitychange`. Lỗi tự chữa trong vòng blur/focus tiếp theo. Cách sửa rõ ràng phải kiểm `hasFocus()`, nhưng hàm này không đáng tin trên iOS Safari — `focus` có thể không bắn khi quay lại từ app switcher, và game có scope mobile. Đổi một lỗi hiếm trên desktop lấy "nhạc không phát lại trên iOS" là giao dịch tồi. |
| Ai giữ listener | `main.js` gắn, `AudioService` chỉ thêm hai method | Đúng khuôn đang có: `main.js` đã tự gắn `pointerdown`/`keydown` để unlock (`main.js:43-44`) và `resize` (`main.js:89`). `AudioService` nhờ đó vẫn không biết gì về DOM ngoài `Audio`, nên test gọi thẳng method, không phải dựng `document` giả. |
| Đã loại: `AudioService` tự đăng ký trong constructor | | Kiểu tiêm `keyTarget` của `SettingsPanel` (`settingsPanel.js:24`) có cái hay là không ai quên nối dây, nhưng ở đây phải tiêm **hai** target (`window` cho blur, `document` cho visibility) và constructor sinh side effect. Đắt hơn giá trị mang lại. |
| Đã loại: handler tự đọc `audio.musicOn` rồi gọi `play`/`pause` | | Đẩy luật của audio ra `main.js`, và phải chép lại điều kiện `#unlocked` mà `AudioService` đang giữ riêng — hai bản sao sẽ lệch nhau. |
| Tạm dừng có ghi vào localStorage không | **Không** | Đây là tạm dừng của hệ thống, không phải lựa chọn của người chơi. Ghi vào `progress.musicOn` sẽ làm công tắc trong Settings hiển thị "off" và biến một lần alt-tab thành tắt nhạc vĩnh viễn. |
| SFX | Không đụng tới | Chúng chỉ phát từ thao tác của người chơi, mà người chơi không thao tác được vào tab đang ẩn hay cửa sổ mất focus. Cụ thể hơn: `InputRouter.onBlur` (`inputRouter.js:128-131`) xoá mọi phím đang giữ khi cửa sổ blur, nên kể cả phím giữ qua alt-tab cũng bị xoá. Thêm luật cho SFX là thừa. |

## 3. `AudioService`

Thêm một cờ riêng `#suspended` và hai method. Không đổi gì ở phần còn lại.

| Method | Hành vi |
|---|---|
| `suspend()` | `#suspended`? return : `#suspended = true`, gọi `#music.pause()`. Không đụng `#progress`. |
| `resume()` | Chỉ phát khi hội đủ **ba** điều: đang `#suspended`, `musicOn` còn bật, và đã `#unlocked`. Xong thì xoá cờ. |

Ba điều kiện của `resume()` lần lượt chặn ba ca hỏng:

- **`#suspended`** — một sự kiện `focus` lạc đàn không được tự bật nhạc mà trước đó không hề có ai
  dừng nó.
- **`musicOn`** — người chơi tắt nhạc trong Settings rồi alt-tab qua lại thì nhạc không được sống
  dậy.
- **`#unlocked`** — chưa ai bấm gì thì không phát; trình duyệt chặn autoplay trước tương tác đầu
  tiên, đúng như ghi chú đã có ở `audioService.js:12-14`.

Nhờ cờ `#suspended`, việc thu nhỏ cửa sổ bắn **cả** `blur` lẫn `visibilitychange` trở nên vô hại:
suspend hai lần vẫn là một lần, resume hai lần cũng vậy. Đây là lý do có cờ, chứ không phải để
trang trí — không có nó thì `resume()` gọi `play()` lên một phần tử đang phát, vô hại trên trình
duyệt nhưng che mất một lỗi thật nếu sau này thứ tự sự kiện đổi.

## 4. Nối dây

Ở `web/src/main.js`, ngay dưới chỗ unlock sẵn có (`main.js:41-44`):

```js
// Nhạc lặp vô hạn, nên một tab bị bỏ quên sẽ kêu mãi. `blur` là bắt buộc bên cạnh
// `visibilitychange`: khi chuyển sang ứng dụng khác, tab vẫn "visible" và chỉ riêng
// visibilitychange thì không bắn.
window.addEventListener('blur', () => audio.suspend());
window.addEventListener('focus', () => audio.resume());
document.addEventListener('visibilitychange', () =>
  (document.hidden ? audio.suspend() : audio.resume()));
```

## 5. Test

Thêm vào `web/tests/audioService.test.mjs`, dùng `FakeAudio` đã có ở đó. Vẫn `node --test`, không
thêm dependency.

| Test | Khẳng định |
|---|---|
| `suspend()` dừng nhạc, `resume()` phát lại | `pauses` lên 1 rồi `plays` lên 2. |
| Tắt nhạc ở Settings thì `resume()` im | `musicOn = false` → suspend → resume → `plays` không tăng. |
| Chưa `unlock()` thì `resume()` im | Không có tương tác nào thì không được phát. |
| `resume()` mà trước đó không suspend thì im | Ca `focus` lạc đàn. |
| Suspend hai lần rồi resume hai lần chỉ tính một | Ca thu nhỏ cửa sổ bắn cả hai sự kiện. |
| `suspend()` không ghi gì vào `progress` | `progress.musicOn` vẫn `true` — công tắc Settings không được đổi mặt. |

## 6. Đã cân nhắc và loại

| Bỏ | Vì sao |
|---|---|
| Giảm dần âm lượng (fade) khi dừng | Cắt thẳng đủ dùng cho một bản nhạc nền `volume: 0.35`. Fade cần timer, mà timer thì phải huỷ đúng lúc khi hai sự kiện bắn liên tiếp. |
| Dùng Page Lifecycle API (`freeze`/`resume`) | Chỉ Chromium có, và nó giải bài toán khác — trình duyệt thu hồi tài nguyên của tab, không phải người chơi rời đi. |
| Dừng cả SFX | Không phát được khi không có tương tác. |
| Dọn luôn 3 file đang sửa dở trong cây làm việc (`gameFlow.js`, `levelPlayer.js`, `gameFlow.test.mjs`) | Không phải của việc này. Chúng có từ trước, để nguyên. |
