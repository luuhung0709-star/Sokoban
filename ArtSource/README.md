# ArtSource/

Sheet pixel art gốc do Gemini sinh, nguyên liệu cho đường ống nhập art trong
`Assets/Editor/ModernArtImporter.cs`. Thư mục này nằm ngoài `Assets/` cố ý — Unity không
import nó, không sinh `.meta`, không tính vào build. Vẫn được commit để lần sau xử lý lại
được từ đúng bản gốc.

## Cho gì vào đây

Một ảnh sprite sheet PNG, lưới 3x3 (tường, sàn, đích, hộp, ô bỏ, bốn hướng nhân vật — xem
`docs/superpowers/specs/2026-07-30-modern-art-import-design.md` mục 3.3 và mục 8 để lấy lại
đúng prompt). **Luôn tải bản gốc về, không chụp màn hình** — ảnh chụp màn hình nén JPEG mất
đủ grain để đường ống không gỡ sạch được (xem mục 10 của spec, bài học từ lần đầu).

Tên file không quan trọng — importer luôn lấy file ảnh **mới nhất** trong thư mục
(`.png`/`.jpg`/`.jpeg`, không phân biệt hoa thường). Cứ thả ảnh mới vào, không cần đổi tên
hay xoá ảnh cũ.

## Chạy import

Hai cách:

- **`Sokoban/Import Modern Art`** (menu) — đường một-cú-bấm cho trường hợp thường: sheet mới
  vẫn xếp đúng lưới 3x3 như `ModernArtImporter.DefaultMapping`. Nếu số vùng dò được lệch với
  9 (ví dụ hai ô dính lại do gutter hụt), menu này **từ chối chạy** và báo lỗi thay vì đoán —
  mở cửa sổ bên dưới để xử lý.
- **`Sokoban/Modern Art Importer`** (cửa sổ) — dùng khi ánh xạ ô → asset không còn đúng thứ tự
  mặc định, hoặc khi cần chỉnh các hằng số (ngưỡng tách nền, ngưỡng khe, khử ám, độ sáng sàn,
  màu tint hộp đích...). Cửa sổ vẽ overlay từng vùng dò được lên chính tấm sheet để xác nhận
  bằng mắt trước khi ghi đè. Đổi ngưỡng tách nền/khe/loại đốm thì phải bấm **Dò lại** trước khi
  Import được phép bấm — nút Import tự khoá nếu overlay đang hiển thị chưa khớp với thiết lập
  hiện tại.

## Kết quả

Mười sprite 64×64 ghi vào `Assets/Art/Modern/`: `wall`, `floor_a`, `floor_b`, `goal`, `box`,
`box_on_goal`, `player_down/up/left/right`. Bốn Tile asset (`WallTile`, `GroundTile`,
`GroundTileB`, `GoalTile`) tự trỏ sang sprite mới; sáu sprite còn lại được gán tay một lần
trong `BoardRenderer` của scene `Main` (xem mục 6.1 của spec).

Import ghi đè đúng cùng đường dẫn PNG mỗi lần, nên **GUID không đổi** — mọi tham chiếu trong
scene và Tile asset vẫn nguyên vẹn sau khi import lại. Không cần nối dây lại từ lần thứ hai
trở đi.

## Thiếu gì hiện tại

`player_up.png` đang là bản lặp của `player_down.png` vì sheet nguồn chưa có ô nhìn từ sau
lưng nhân vật (mũ và lưng). Cần Gemini vẽ lại đúng ô đó rồi import lại — không tự sửa bằng
cách gán tạm ô khác vào slot `PlayerUp`.
