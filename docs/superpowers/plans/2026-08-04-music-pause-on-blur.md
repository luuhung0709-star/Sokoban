# Tạm dừng nhạc nền khi người chơi rời đi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhạc nền tự im khi người chơi ẩn tab hoặc chuyển sang ứng dụng khác, và phát tiếp khi họ quay lại.

**Architecture:** `AudioService` nhận thêm một cờ riêng `#suspended` và hai method `suspend()`/`resume()`; nó vẫn không biết gì về DOM ngoài `Audio`. `main.js` — nơi đã gắn sẵn mọi listener cấp window — nối ba sự kiện `blur`, `focus`, `visibilitychange` vào hai method đó. Tạm dừng của hệ thống cố ý không ghi vào `progress`, nên công tắc trong Settings không bị đổi mặt sau một lần alt-tab.

**Tech Stack:** HTML + CSS + JavaScript thuần, ES module, không build step. Test bằng `node --test`.

Spec: [2026-08-04-music-pause-on-blur-design.md](../specs/2026-08-04-music-pause-on-blur-design.md)

## Global Constraints

- **Không thêm dependency.** `web/package.json` không có `dependencies` lẫn `devDependencies`, và đó là lý do game không cần build step.
- **Chữ trên giao diện là tiếng Anh.** Comment trong code cũng tiếng Anh. Chỉ plan và spec là tiếng Việt.
- **Chính tả Anh-Anh trong comment** (`colour`, `neighbour`, `normalise`, `minimising`) — khớp code đang có.
- **Comment giải thích *tại sao*, không phải *cái gì*.**
- Test chạy bằng `cd web && npm test`. Chạy một file: `cd web && node --test tests/audioService.test.mjs`.
- Không dùng jsdom. Test của `AudioService` dùng `FakeAudio` đã có sẵn trong chính file test của nó.
- Commit sau mỗi task, message tiếng Việt, một dòng tiêu đề dưới 72 ký tự.
- Nhánh làm việc: `music-pause` (branched từ `main` ở commit `d943fca`). `hint-settings` đã merge vào main nên tạo nhánh mới — điều này tránh được đúng hazard mà cảnh báo bên dưới nêu ra. Thư mục gốc: `d:/Hung/Sokoban`.
- **Có thể có session khác làm việc song song trên cùng nhánh này.** Lúc viết plan, 3 file sửa dở (`gameFlow.js`, `levelPlayer.js`, `gameFlow.test.mjs`) đã bị một tiến trình khác commit mất giữa chừng (`8c07edd`). Vì vậy mọi lệnh `git add` trong plan đều liệt kê đường dẫn cụ thể — **không bao giờ** dùng `git add -A` hay `git commit -a`, kẻo nuốt phải việc của người khác. Chạy `git status` trước mỗi commit để biết mình đang đứng ở đâu.

---

## File Structure

**Sửa**

| File | Việc |
|---|---|
| `web/src/audio/audioService.js` | Thêm trường `#suspended` và hai method `suspend()`/`resume()`. Không đổi gì khác. |
| `web/src/main.js` | Gắn ba listener gọi hai method trên. |
| `web/tests/audioService.test.mjs` | Thêm 6 test vào cuối file, dùng `FakeAudio` và `setup()` đã có. |

Không tạo file mới. Không có file nào bị xoá.

---

## Task 1: `suspend()` và `resume()` trên `AudioService`

**Files:**
- Modify: `web/src/audio/audioService.js` (thêm vào sau `unlock()`, hiện ở dòng 55-59)
- Test: `web/tests/audioService.test.mjs` (thêm vào cuối, sau dòng 113)

**Interfaces:**
- Consumes: `AudioService` đang có — trường riêng `#music` (một `Audio` với `loop = true`), `#unlocked` (đặt `true` trong `unlock()`), và getter `musicOn` đọc `#progress.musicOn`.
- Produces: `audio.suspend(): void` và `audio.resume(): void`. Task 2 gọi đúng hai tên này, không tham số, không giá trị trả về.

- [ ] **Step 1: Viết 6 test đang hỏng**

Thêm vào **cuối** `web/tests/audioService.test.mjs`. Không sửa test nào đang có.

```js
test('suspend pauses the loop and resume starts it again', () => {
  const { audio, music } = setup();
  audio.unlock();

  audio.suspend();
  assert.equal(music.pauses, 1);

  audio.resume();
  assert.equal(music.plays, 2, 'one play from unlock, one from resume');
});

test('resume stays silent when the player has switched the music off', () => {
  const { audio, music } = setup();
  audio.unlock();
  audio.musicOn = false;

  audio.suspend();
  audio.resume();

  assert.equal(music.plays, 1, 'the only play is the one from unlock');
});

test('resume stays silent before the first interaction', () => {
  const { audio, music } = setup();

  audio.suspend();
  audio.resume();

  assert.equal(music.plays, 0, 'nothing may play before the page has been interacted with');
});

test('a stray resume with nothing suspended does not start the music', () => {
  const { audio, music } = setup();
  audio.unlock();

  audio.resume();

  assert.equal(music.plays, 1, 'still just the unlock play');
});

test('suspending twice then resuming twice counts as once', () => {
  const { audio, music } = setup();
  audio.unlock();

  // Minimising the window fires blur AND visibilitychange, so both arrive back to back.
  audio.suspend();
  audio.suspend();
  audio.resume();
  audio.resume();

  assert.equal(music.pauses, 1, 'the second suspend must be a no-op');
  assert.equal(music.plays, 2, 'and the second resume too');
});

test('suspend does not touch the saved music setting', () => {
  const { audio, progress } = setup();
  audio.unlock();

  audio.suspend();

  assert.equal(progress.musicOn, true, 'the Settings switch must still read as on');
});
```

- [ ] **Step 2: Chạy test cho chắc là nó hỏng**

Run: `cd web && node --test tests/audioService.test.mjs`

Expected: FAIL. Sáu test mới báo `TypeError: audio.suspend is not a function`. Bảy test cũ vẫn PASS — nếu có test cũ nào hỏng thì dừng lại, bạn vừa sửa nhầm thứ gì đó.

- [ ] **Step 3: Viết phần cài đặt tối thiểu**

Trong `web/src/audio/audioService.js`, thêm trường riêng vào khối khai báo đầu class (cạnh `#unlocked = false;`):

```js
  #suspended = false;
```

Rồi thêm hai method ngay **sau** `unlock()` và **trước** `play()`:

```js
  /**
   * Pauses the music while the player is away. This is the system's doing, not the
   * player's, so it deliberately leaves `progress.musicOn` alone: writing to it would
   * flip the Settings switch to off and turn one alt-tab into a permanent mute.
   */
  suspend() {
    if (this.#suspended) return;
    this.#suspended = true;
    this.#music.pause();
  }

  /**
   * All three conditions earn their place. `#suspended` stops a stray focus event
   * starting music that nobody paused; `musicOn` stops it overriding the player's own
   * switch; `#unlocked` keeps the autoplay rule above intact.
   */
  resume() {
    if (!this.#suspended) return;
    this.#suspended = false;
    if (this.musicOn && this.#unlocked) void this.#music.play().catch(() => {});
  }
```

- [ ] **Step 4: Chạy lại toàn bộ test**

Run: `cd web && npm test`

Expected: PASS — cả 13 test của `audioService.test.mjs` và mọi test khác trong `web/tests/`. Con số phải là **toàn bộ file test xanh**, không riêng file vừa sửa: `main.js` chưa đổi nên không file nào khác được phép hỏng.

- [ ] **Step 5: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/audio/audioService.js web/tests/audioService.test.mjs
git commit -m "AudioService: thêm suspend/resume cho nhạc nền"
```

---

## Task 2: Nối ba sự kiện trong `main.js`

**Files:**
- Modify: `web/src/main.js:41-44` (thêm ngay dưới khối unlock đang có)

**Interfaces:**
- Consumes: `audio.suspend()` và `audio.resume()` từ Task 1. Biến `audio` đã dựng ở `main.js:35`.
- Produces: không có gì cho task sau — đây là task cuối.

- [ ] **Step 1: Thêm ba listener**

`main.js` là nơi ráp nối, không có test đơn vị — nó chỉ chạy trong trình duyệt thật. Nên task này không có test tự động; bước xác minh là bước 2 và 3.

Thêm vào `web/src/main.js` ngay sau hai dòng `unlockAudio` (hiện ở dòng 43-44):

```js
// The loop never ends on its own, so a forgotten tab plays for ever. `blur` is needed
// alongside `visibilitychange`: switching to another application leaves the tab itself
// visible, so visibilitychange alone never fires and the music carries on.
window.addEventListener('blur', () => audio.suspend());
window.addEventListener('focus', () => audio.resume());
document.addEventListener('visibilitychange', () =>
  (document.hidden ? audio.suspend() : audio.resume()));
```

- [ ] **Step 2: Chạy test cho chắc là không vỡ gì**

Run: `cd web && npm test`

Expected: PASS, đúng những test đã xanh ở Task 1. `main.js` không được import bởi test nào, nên con số phải y hệt — khác đi là dấu hiệu bạn sửa nhầm file.

- [ ] **Step 3: Xác minh trong trình duyệt thật**

Dựng server tĩnh (game dùng `fetch` cho `microban.json` nên mở file trực tiếp bằng `file://` sẽ hỏng):

```bash
cd d:/Hung/Sokoban/web && python -m http.server 8000
```

Mở `http://localhost:8000`, bấm chuột một cái để mở khoá âm thanh, rồi kiểm bốn ca:

| Thao tác | Mong đợi |
|---|---|
| Alt-tab sang ứng dụng khác | Nhạc im |
| Quay lại cửa sổ trình duyệt | Nhạc phát tiếp |
| Chuyển sang tab khác rồi quay lại | Im rồi phát tiếp |
| Tắt Music trong Settings → alt-tab đi và về | Vẫn im, và công tắc vẫn hiển thị off |

Ca cuối là ca dễ hỏng nhất — nó kiểm cả `musicOn` lẫn việc `suspend()` không ghi vào `progress`.

**Tắt server khi xong** (`Ctrl+C`). Một server tĩnh bị bỏ quên cùng một tab còn mở chính là chuyện đã đẻ ra việc này ngay từ đầu.

- [ ] **Step 4: Commit**

```bash
cd d:/Hung/Sokoban
git add web/src/main.js
git commit -m "Nối blur/focus/visibilitychange vào suspend nhạc nền"
```

---

## Self-review

Đã soát plan ngược lại spec:

- **Phủ spec** — mục 3 của spec (`#suspended`, `suspend()`, `resume()` với ba điều kiện) nằm ở Task 1 bước 3; mục 4 (nối dây) ở Task 2 bước 1; cả 6 test ở mục 5 có mặt nguyên văn ở Task 1 bước 1. Mục 6 của spec toàn là thứ bị loại nên không sinh task nào.
- **Không placeholder** — mọi bước có code thật hoặc lệnh chạy thật.
- **Tên khớp nhau** — `suspend()`/`resume()` gọi ở Task 2 đúng tên đã định nghĩa ở Task 1; `audio` đúng tên biến ở `main.js:35`; `setup()`, `music`, `progress`, `plays`, `pauses` đúng tên trong `FakeAudio` và `setup()` đang có ở file test.
- **Một chỗ lệch nhỏ so với spec, đã sửa trong plan:** spec mục 3 mô tả `suspend()` là "gọi `#music.pause()`" không kèm điều kiện, nhưng bảng test lại đòi suspend hai lần chỉ tính một. Plan chốt theo bảng test — `suspend()` có `if (this.#suspended) return;` — vì đó mới khớp câu "suspend hai lần vẫn là một lần" ở đoạn cuối mục 3.
