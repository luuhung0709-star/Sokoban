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

`src/levels/microban.json` sinh ra từ `tools/microban.txt`, chạy tay rồi commit:

```bash
cd web && node tools/import-microban.mjs
```

Thay bộ màn khác thì ghi đè `tools/microban.txt` bằng file định dạng Microban rồi chạy lại.
Script tự kiểm mọi màn và **dừng, không ghi gì** nếu có màn sai định dạng.

## Level editor

Mở `/editor/` qua local server. Trang này không nằm trong bản deploy.
