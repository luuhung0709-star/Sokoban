# Thiết kế: Nhập bộ art mới từ sprite sheet do Gemini tạo

Ngày: 2026-07-30

## 1. Mục tiêu

Thay bộ art hiện tại (sinh bằng code, tường vát cạnh phẳng, nhân vật là khối bầu dục có mũi chỉ hướng)
bằng một bộ art vẽ tay giàu chi tiết hơn: tường đá bo góc có vân nứt, hộp gỗ có ván và nẹp kim loại,
sàn ô caro sáng/tối xen kẽ, nhân vật là người mặc vest đen đội mũ phớt.

Art do người dùng tạo bên Gemini và giao dưới dạng **một sprite sheet duy nhất**. Phần việc trong repo
là dựng đường ống nhập: cắt sheet thành 10 sprite rời, tách nền, chuẩn hoá khung, ghi vào project với
import setting đúng, và nối vào Tile asset + prefab + scene.

Thành công khi: lần đầu nối dây xong, mọi lần thay art sau đó chỉ cần bỏ sheet mới vào `ArtSource/` và
bấm một menu là game đổi art, không phải chạm vào Inspector (xem mục 6).

## 2. Bối cảnh

Hiện tại `Assets/Editor/ClassicTileGenerator.cs` sinh 9 ảnh 64×64 vào `Assets/Art/Classic/` bằng thuật
toán vẽ thuần (bevel, ring, cross, ellipse). Import setting: Sprite, PPU 64, `FilterMode.Point`,
uncompressed. Ba Tile asset trong `Assets/Tiles/` trỏ vào các sprite đó; sáu sprite còn lại (hộp ×2,
nhân vật ×4) gán trực tiếp vào `BoardRenderer` trong scene `Main`.

`BoardRenderer.Render` hiện vẽ một loại sàn duy nhất cho mọi ô không phải tường.

Camera background đã là `#0D0D10`, khớp sẵn nền tối của art mới nên không phải đổi.

## 3. Quyết định

### 3.1 Art mới nằm ở thư mục riêng, không ghi đè art cũ

Art mới ghi vào **`Assets/Art/Modern/`**. Không đụng `Assets/Art/Classic/`.

Lý do: menu `Sokoban/Generate Classic Art` vẫn tồn tại và ghi đè thẳng vào `Assets/Art/Classic/`. Nếu
art mới dùng chung thư mục đó thì một cú bấm nhầm menu là mất sạch. Hai thư mục tách biệt cho phép hai
bộ art cùng tồn tại và đổi qua lại để so sánh.

### 3.2 Ảnh gốc để ngoài `Assets/`

Sheet gốc từ Gemini để ở **`ArtSource/`** tại thư mục gốc repo, ngoài `Assets/`. Unity không import,
không sinh `.meta`, không tính vào build. Vẫn được commit để lần sau xử lý lại từ bản gốc độ phân giải
cao mà không phải tạo lại ảnh.

### 3.3 Bố cục sheet: 4 cột × 3 hàng, ảnh vuông

```
hàng 1:  wall         floor_a       floor_b      goal
hàng 2:  box          box_on_goal   player_down  player_up
hàng 3:  player_left  player_right  (trống)      (trống)
```

Chọn lưới 4×3 trên ảnh tỉ lệ 1:1 vì Gemini xuất ảnh theo tập tỉ lệ cố định và 1:1 là tỉ lệ nó xử lý tốt
nhất. Lưới 5×2 vừa khít 10 ô nhưng ép ra tỉ lệ 2.5:1, không có trong tập tỉ lệ Gemini hỗ trợ.

Hai ô cuối để trống. Nếu Gemini vẫn vẽ gì đó vào đó, importer lấy 10 vùng đầu theo thứ tự đọc và bỏ qua
phần dư.

### 3.4 Cắt bằng dò khe, không dùng lưới cứng

Không tính toạ độ ô theo `width / 4`. Gemini gần như chắc chắn xếp lệch lưới đôi chút, và lưới cứng sẽ
cắt cụt hoặc dính sang ô bên cạnh.

Thay vào đó **dò khe**: quét tìm các hàng và cột gồm toàn pixel màu nền, lấy các dải nội dung nằm giữa
chúng làm biên vùng. Dò ra đúng 10 vùng thì gán tên theo thứ tự đọc trái→phải, trên→dưới. Ra sai số
lượng thì chuyển sang chế độ lưới chỉnh tay trong editor window.

### 3.5 Đầu ra 128 hoặc 256 px, filter Bilinear

Sheet chia 12 ô nên mỗi ô chỉ được 1/4 chiều rộng sheet, trừ tiếp khe hở. Sheet 1024×1024 cho mỗi ô
thực dùng khoảng 200px; sheet 2048×2048 cho khoảng 512px.

Importer tự chọn theo kích thước ô đo được: ô nhỏ hơn 300px → xuất sprite 128×128; ô từ 300px trở lên
→ xuất 256×256. Editor window cho override thủ công.

PPU đặt bằng đúng cạnh sprite (128 hoặc 256) nên **1 ô = 1 unit** không đổi. Không phải sửa camera,
level data, hay logic di chuyển.

Bỏ `FilterMode.Point`, dùng **Bilinear**. Art Gemini là nét vẽ mượt chứ không phải pixel art; để Point
sẽ răng cưa khi scale.

## 4. Kiến trúc

Tách làm ba phần để phần tính toán test được mà không cần Unity Editor API:

### 4.1 `SpriteSheetSlicer` — logic thuần, không đụng AssetDatabase

Nhận vào mảng `Color32[]` + kích thước, trả ra kết quả. Không gọi `AssetDatabase`, không đọc/ghi file.

| Hàm | Nhiệm vụ |
|---|---|
| `DetectBackground` | Lấy màu khoá từ 4 góc ảnh; nếu ảnh đã có alpha thật (tồn tại pixel `a < 250`) thì báo là dùng alpha sẵn có |
| `KeyOut` | Xoá pixel gần màu khoá theo ngưỡng khoảng cách màu; khử ám màu nền còn dính ở mép |
| `FindRegions` | Dò hàng/cột toàn nền, trả về danh sách `RectInt` vùng nội dung theo thứ tự đọc |
| `CropToContent` | Cắt sát bounding box của pixel không trong suốt |
| `FitSquare` | Đặt vùng đã cắt vào canvas vuông, có tham số lề |
| `Resize` | Nội suy bilinear về kích thước đích |

### 4.2 `ModernArtImporter` — phần đụng Unity

Đọc file từ `ArtSource/`, gọi `SpriteSheetSlicer`, ghi PNG vào `Assets/Art/Modern/`, đặt import setting,
tạo/cập nhật Tile asset. Menu `Sokoban/Import Modern Art` chạy toàn bộ với thiết lập mặc định.

### 4.3 `ModernArtImporterWindow` — editor window kiểm tra trước khi ghi

Vẽ overlay các vùng đã dò lên chính tấm sheet để mắt thường xác nhận trước khi ghi đè asset. Có ô chỉnh
tay: số cột, số hàng, lề, khe, ngưỡng tách nền, kích thước đầu ra. Nút Import ghi asset.

Theo tiền lệ `Assets/Editor/LevelCollectionWindow.cs` sẵn có trong project.

Giá trị mặc định: ngưỡng tách nền 0.25 (khoảng cách RGB đã chuẩn hoá về 0..1), lề tile 4%, ngưỡng coi
một hàng/cột là khe khi từ 99% pixel trở lên là màu nền.

## 5. Chuẩn hoá khung theo loại asset

Tile và vật thể xử lý khác nhau ở bước đặt vào canvas vuông:

- **Tile** (`wall`, `floor_a`, `floor_b`): cắt sát nội dung rồi đặt vào canvas vuông **chừa lề nhỏ**
  (mặc định 4% mỗi cạnh). Giữ lại khe hở tối giữa các viên gạch như trong ảnh mẫu; cắt sát rồi phóng
  đầy ô sẽ làm các viên dính liền nhau.
- **`goal`**: nền trong suốt quanh dấu đích. Tilemap đích vẽ đè lên tilemap sàn, nên `goal` chỉ chứa
  dấu hiệu, phần còn lại phải trong suốt để lộ sàn bên dưới. Nhờ vậy một sprite `goal` dùng chung được
  cho cả hai tông sàn ô caro.
- **Vật thể** (`box`, `box_on_goal`, `player_*`): cắt sát rồi căn giữa vào canvas vuông, giữ nguyên tỉ
  lệ khung hình gốc.

## 6. Nối dây và sàn ô caro

### 6.1 Nối dây một lần, các lần sau tự cập nhật

Importer luôn ghi ra **đúng cùng một đường dẫn** cho mỗi asset (`Assets/Art/Modern/box.png`, …). Ghi đè
một file PNG có sẵn giữ nguyên `.meta` và GUID của nó, nên mọi tham chiếu đang trỏ tới sprite đó vẫn
còn nguyên. Hệ quả: chỉ cần nối dây **một lần**.

- **Tile asset** (`WallTile`, `GroundTile`, `GroundTileB`, `GoalTile`): importer tự tạo nếu chưa có và
  tự trỏ `m_Sprite` sang sprite mới. Không cần thao tác tay.
- **Sáu sprite còn lại** (`box`, `box_on_goal`, `player_up/down/left/right`): gán tay một lần vào
  `BoardRenderer` trong scene `Main`, vì chúng là tham chiếu nằm trong scene chứ không phải asset độc
  lập. Từ lần import thứ hai trở đi GUID không đổi nên không phải gán lại.

### 6.2 Sàn ô caro

Đây là thay đổi runtime duy nhất trong toàn bộ việc này.

- Thêm Tile asset `Assets/Tiles/GroundTileB.asset`.
- `BoardRenderer` thêm trường `[SerializeField] TileBase groundTileB`.
- Trong `Render`, ô nền chọn tile theo `(x + y) % 2 == 0 ? groundTile : groundTileB`.
- Hàm `Resolve` hiện có xử lý trường hợp thiếu Tile asset bằng cách vẽ ô hồng chói và log lỗi. Giữ
  nguyên cơ chế đó cho `groundTileB`.

## 7. Test

`Assets/Tests/EditMode/Sokoban.Tests.EditMode.asmdef` hiện chỉ tham chiếu `Sokoban.Runtime`. Thêm
`Sokoban.Editor` vào `references` để test được `SpriteSheetSlicer`.

Test dựng ảnh giả bằng code (không cần file ảnh thật) và kiểm:

| Test | Kiểm điều gì |
|---|---|
| Tách nền đúng | Pixel màu khoá thành trong suốt |
| Không xoá nhầm | Pixel vật thể có màu gần màu khoá nhưng ngoài ngưỡng thì giữ lại |
| Đã có alpha | Ảnh vào đã có alpha thật thì không keying, giữ nguyên alpha |
| Dò vùng | Ảnh giả 4×3 ô có khe rõ → trả về đúng 12 vùng, đúng thứ tự đọc |
| Dò vùng, ô trống | Hai ô cuối toàn nền → trả về đúng 10 vùng |
| Crop | Bounding box đúng, không thừa không thiếu một pixel |
| Canvas vuông | Đầu ra vuông, vật thể căn giữa, lề tile đúng tỉ lệ |
| Resize | Đầu ra đúng kích thước đích |

## 8. Prompt cho Gemini

Kèm theo spec là một prompt để người dùng dán vào Gemini, ràng buộc:

- Sheet vuông 1:1, xuất ở độ phân giải lớn nhất có thể (ưu tiên 2K trở lên).
- Lưới 4 cột × 3 hàng, có khe hở rõ giữa các ô, hai ô cuối để trống.
- Nền toàn ảnh màu hồng đặc `#FF00FF`, kể cả trong khe.
- Nhìn thẳng từ trên xuống, không phối cảnh nghiêng.
- Không có bóng đổ tràn ra ngoài vật thể sang vùng nền.
- Mô tả style bám theo ảnh mẫu: tường đá xám bo góc có vân nứt, sàn hai tông xám đậm, hộp gỗ vàng có
  ván và nẹp, hộp thường mang dấu tròn / hộp đã vào đích mang dấu chữ thập, nhân vật nam mặc vest đen
  sơ mi trắng đội mũ phớt, vẽ ở 4 hướng nhìn.

## 9. Ngoài phạm vi

Đã cân nhắc và loại theo yêu cầu người dùng:

- Bóng đổ mềm dưới cả bàn cờ.
- Dải nền sáng hơn chạy sau bàn cờ.
- Xoá hoặc sửa `ClassicTileGenerator` và `Assets/Art/Classic/`.

## 10. Rủi ro đã biết

**Chất lượng cuối phụ thuộc gần như hoàn toàn vào ảnh Gemini trả về.** Đường ống nhập chỉ cắt và chuẩn
hoá, không sửa được nét vẽ.

Gộp 10 asset vào một sheet đánh đổi độ chi tiết lấy tính đồng nhất: mỗi asset chỉ chiếm 1/12 khung nên
nhân vật sẽ ít chi tiết mặt và trang phục hơn so với vẽ riêng một ảnh; bù lại 10 asset chắc chắn cùng
nguồn sáng, cùng bảng màu, và 4 hướng nhân vật chắc chắn là cùng một người.

Nếu Gemini xếp lưới lệch tới mức dò khe không ra 10 vùng, editor window có chế độ lưới chỉnh tay làm
đường lui.
