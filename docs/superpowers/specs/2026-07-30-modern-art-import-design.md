# Thiết kế: Nhập bộ art mới từ sprite sheet do Gemini tạo

Ngày: 2026-07-30 (sửa lần 2 sau khi đo ảnh thật)

## 1. Mục tiêu

Thay bộ art hiện tại (sinh bằng code, tường vát cạnh phẳng, nhân vật là khối bầu dục có mũi chỉ hướng)
bằng bộ art pixel do người dùng tạo bên Gemini: tường gạch đá, sàn lát gạch, đích là vòng tròn đỏ có
chữ thập, hộp gỗ, và nhân vật nam mặc vest đen đội mũ phớt có đủ 4 hướng nhìn.

Art giao dưới dạng **một sprite sheet duy nhất**. Phần việc trong repo là dựng đường ống nhập: cắt sheet
thành sprite rời, tách nền, khử nhiễu về đúng lưới pixel gốc, sinh thêm các biến thể bằng code, ghi vào
project với import setting đúng, và nối vào Tile asset + scene.

Thành công khi: lần đầu nối dây xong, mọi lần thay art sau đó chỉ cần đè sheet mới vào `ArtSource/` và
bấm một menu là game đổi art, không phải chạm vào Inspector (xem mục 6).

## 2. Bối cảnh

`Assets/Editor/ClassicTileGenerator.cs` sinh 9 ảnh 64×64 vào `Assets/Art/Classic/` bằng thuật toán vẽ
thuần. Import setting: Sprite, PPU 64, `FilterMode.Point`, uncompressed. Ba Tile asset trong
`Assets/Tiles/` trỏ vào các sprite đó; sáu sprite còn lại (hộp ×2, nhân vật ×4) gán trực tiếp vào
`BoardRenderer` trong scene `Main`.

`BoardRenderer.Render` hiện vẽ một loại sàn duy nhất cho mọi ô không phải tường.

Camera background đã là `#0D0D10`, khớp sẵn nền tối của art mới nên không phải đổi.

## 3. Quyết định

### 3.1 Art mới nằm ở thư mục riêng, không ghi đè art cũ

Art mới ghi vào **`Assets/Art/Modern/`**. Không đụng `Assets/Art/Classic/`.

Lý do: menu `Sokoban/Generate Classic Art` vẫn tồn tại và ghi đè thẳng vào `Assets/Art/Classic/`. Nếu
art mới dùng chung thư mục đó thì một cú bấm nhầm menu là mất sạch.

### 3.2 Ảnh gốc để ngoài `Assets/`

Sheet gốc để trong **`ArtSource/`** tại thư mục gốc repo, ngoài `Assets/`. Unity không import, không
sinh `.meta`, không tính vào build. Vẫn được commit để lần sau xử lý lại từ bản gốc.

Importer **không đòi tên file cố định** — nó lấy file ảnh mới nhất trong thư mục. Gemini đặt tên kiểu
`Gemini_Generated_Image_pq5cgypq5cgypq5c.png`, bắt người dùng đổi tên mỗi lần chỉ tạo thêm một bước dễ
quên. Có nhiều hơn một file thì window cho chọn.

### 3.3 Bố cục sheet 3×3, ánh xạ ô → asset chỉnh được trong editor window

Sheet thực tế Gemini trả về là lưới **3 hàng × 3 cột = 9 ô**:

```
hàng 1:  wall          floor          goal
hàng 2:  box           (không dùng)   player_down
hàng 3:  player_up     player_right   player_left
```

Không hard-code ánh xạ này. Gemini xếp lưới khác nhau giữa các lần sinh, nên editor window cho chọn
asset cho từng vùng đã dò bằng dropdown, và nhớ lựa chọn trong `EditorPrefs` để lần sau không phải
chọn lại.

Ô hàng 2 cột 2 trong sheet hiện tại là hộp-trên-đích nhưng **không dùng** — xem 3.6.

### 3.4 Tách nền: khoá theo "độ magenta", không lấy mẫu 4 góc

Ảnh thật có **hai tông hồng**: nền ngoài magenta đậm (đo được `(253, 31, 252)`) và nền riêng của từng ô
màu hồng nhạt. Lấy mẫu 4 góc chỉ bắt được tông đậm, mỗi sprite sẽ còn nguyên một vuông hồng nhạt.

Dùng phép thử độ magenta thay thế: `R > 180 && B > 180 && G < min(R, B) - 25`.

Đã kiểm trên ảnh thật: bắt được cả hai tông hồng, và **không** bắt nhầm bất kỳ màu nào của art — đá xám
có `R≈G≈B`; gỗ nâu và vòng đích đỏ đều có `B` thấp; áo sơ mi trắng có `G` không thấp hơn `R`; da mặt có
`B` thấp.

Ngưỡng để nới rộng cho nhiễu JPEG là hằng số chỉnh được trong window.

### 3.5 Xuất 64×64, PPU 64, filter Point, downsample trung bình vùng

Art trả về là **pixel art**, không phải nét vẽ mượt như dự kiến ban đầu. Dùng **`FilterMode.Point`**;
Bilinear sẽ làm nhoè hết chất pixel.

**Cỡ đầu ra 64×64, PPU 64.** Đã thử mắt trên ảnh thật ở 32/40/48/56/64/96: từ 48 trở lên là sạch, 32 và
40 bị nhoè mất mạch vữa của tường. Chọn 64 vì nó dư an toàn trên cỡ grain đo được (~8.25px trên ô 439px,
tức native khoảng 48–53), và vì **trùng đúng PPU 64 của bộ art hiện tại** — Tile asset, prefab và camera
không phải chỉnh gì.

**Không snap về lưới pixel gốc.** Ý này bị loại sau khi đo ảnh full-res: đây là pixel art do AI vẽ giả,
grain trôi giữa 8, 9 và 10 px chứ không có lưới cố định toàn ảnh. Snap vào một lưới không tồn tại sẽ làm
lệch và nhoè. Thay vào đó **downsample trung bình vùng** (box filter) từ ảnh gốc — nguồn là PNG lossless
1408×3054 nên đủ sạch, không cần khử nhiễu nén.

Bản đầu tiên người dùng gửi là **ảnh chụp màn hình JPEG 472×1024**, grain chỉ còn ~2.75px, nhỏ hơn cả
block DCT 8×8 của JPEG — nhiễu nén thô hơn chính hạt pixel art, không gỡ sạch được bằng code. Ghi lại
đây để lần sau luôn yêu cầu **bản tải gốc PNG**, không phải ảnh chụp màn hình.

### 3.5b Khử ám hồng ở mép

Bounding box của mỗi vùng ôm luôn các pixel khử răng cưa nằm giữa art và nền hồng. Không xử lý thì
sprite còn viền hồng — nhìn rõ nhất ở khung ngoài của ô tường.

Sau khi khoá nền, quét các pixel còn lại nằm sát pixel trong suốt: nếu màu của chúng lệch về phía
magenta so với hàng xóm không trong suốt, kéo kênh R và B xuống cho khớp hàng xóm. Ngưỡng chỉnh được
trong window.

### 3.6 Ba asset sinh bằng code, không lấy từ sheet

| Asset | Sinh từ | Lý do |
|---|---|---|
| `floor_a` | `floor` × 0.55 độ sáng | Xem 3.7 |
| `floor_b` | `floor` × 0.45 độ sáng | Tông thứ hai cho ô caro; sheet không có |
| `box_on_goal` | `box` + phủ tint vàng ấm | Xem dưới |

Ô hộp-trên-đích trong sheet vẽ một cái thùng **nghiêng và nhỏ hơn** nằm lọt trong vòng đích, khác hẳn ô
hộp thường vốn là thùng nhìn thẳng. Dùng cả hai thì khi đẩy hộp vào đích hình sẽ nhảy sang một cái thùng
khác chứ không phải cùng cái thùng đó được đánh dấu. Phủ tint bằng code giữ nguyên một cái thùng duy
nhất, chỉ đổi màu.

Hệ số 0.55 / 0.45 và màu tint là hằng số chỉnh được trong window.

### 3.7 Làm tối sàn để lấy lại tương phản với tường

Đo trên ảnh thật, độ sáng trung bình: tường **121.8**, sàn **131.8**. Sàn còn *sáng hơn* tường, gần như
không có tương phản — nhìn vào bàn cờ sẽ khó tách tường khỏi đường đi. Ảnh mẫu ban đầu người dùng gửi có
tường ~185 và sàn ~78, chênh nhau rất rõ.

Không yêu cầu tạo lại ảnh. Hạ độ sáng sàn bằng code (3.6) vừa lấy lại tương phản, vừa tiện sinh luôn
tông thứ hai cho ô caro, và đảm bảo hai tông khớp tuyệt đối với nhau.

## 4. Kiến trúc

Tách làm ba phần để phần tính toán test được mà không cần Unity Editor API:

### 4.1 `SpriteSheetSlicer` — logic thuần, không đụng AssetDatabase

Nhận vào mảng `Color32[]` + kích thước, trả ra kết quả. Không gọi `AssetDatabase`, không đọc/ghi file.

| Hàm | Nhiệm vụ |
|---|---|
| `IsBackground` | Phép thử độ magenta ở 3.4, ngưỡng truyền vào |
| `FindRegions` | Dò hàng/cột toàn nền → vùng nội dung; rồi thu từng vùng về bounding box riêng của nó. Lọc bỏ vùng có diện tích nhỏ hơn 25% diện tích trung vị (loại watermark Gemini ở góc dưới phải) |
| `KeyOut` | Đặt alpha 0 cho pixel nền |
| `Despill` | Khử ám hồng ở mép theo 3.5b |
| `BoxDownsample` | Thu nhỏ bằng trung bình vùng, có tính trọng số alpha |
| `FitCanvas` | Đặt vùng đã cắt vào canvas vuông theo quy tắc tỉ lệ ở mục 5 |
| `Scale` | Nhân độ sáng RGB, giữ alpha — dùng cho `floor_a` / `floor_b` |
| `Tint` | Phủ màu theo tỉ lệ, giữ alpha — dùng cho `box_on_goal` |

### 4.2 `ModernArtImporter` — phần đụng Unity

Đọc file từ `ArtSource/`, gọi `SpriteSheetSlicer`, ghi PNG vào `Assets/Art/Modern/`, đặt import setting
(Sprite, PPU = cạnh sprite, `FilterMode.Point`, uncompressed, `alphaIsTransparency`, no mipmap), tạo và
cập nhật Tile asset. Menu `Sokoban/Import Modern Art` chạy toàn bộ với thiết lập đã lưu.

### 4.3 `ModernArtImporterWindow` — editor window kiểm tra trước khi ghi

Vẽ overlay các vùng đã dò lên chính tấm sheet để mắt thường xác nhận trước khi ghi đè asset. Mỗi vùng có
một dropdown chọn asset đích. Chỉnh được: ngưỡng tách nền, cỡ hạt pixel, lề tile, hệ số làm tối sàn, màu
tint hộp. Nút Import ghi asset.

Theo tiền lệ `Assets/Editor/LevelCollectionWindow.cs` sẵn có trong project.

## 5. Chuẩn hoá khung và tỉ lệ

Mọi sprite đều ra canvas vuông 64×64 nên đều là 1×1 unit. Khác nhau ở chỗ vật thể chiếm bao nhiêu phần
của canvas đó.

**Mốc quy chiếu là ô tường.** Tường là asset duy nhất chắc chắn lấp đầy một ô theo thiết kế, nên lấy
cạnh dài bounding box của nó (đo được 467px) làm "một ô". Không dùng bước lưới tính từ khoảng cách các
vùng: đo được cột cách nhau ~491px còn hàng ~524px, lưới Gemini không vuông.

- **`wall`, `floor`**: ép kín canvas. Đo được 439×467 và 436×467 — lệch vuông 6%, ép vuông không nhìn ra.
  Tile bắt buộc phải phủ hết ô, không được chừa khe trong suốt.
- **`goal`**: căn giữa, **giữ tỉ lệ so với ô tường** (341/467 ≈ 0.73 ô). Nền quanh vòng đích phải trong
  suốt: tilemap đích vẽ đè lên tilemap sàn, nên phần ngoài vòng phải để lộ sàn bên dưới. Nhờ vậy một
  sprite `goal` dùng chung được cho cả hai tông sàn ô caro.
- **`box`, `player_*`**: căn giữa, giữ tỉ lệ so với ô tường và **giữ nguyên tỉ lệ khung hình gốc**. Đo
  được nhân vật 205×377 và hộp 289×387 — ép vuông sẽ làm họ béo ra rất rõ, còn chuẩn hoá theo bounding
  box riêng của từng cái sẽ phá tương quan kích thước mà người vẽ đã đặt.

Mỗi asset có thêm một **hệ số tỉ lệ chỉnh tay** trong window, mặc định 1.0. Cần nó vì tương quan kích
thước Gemini vẽ ra không phải lúc nào cũng hợp lý — hộp đo được chỉ rộng 0.62 ô, có thể trông hơi nhỏ
khi ghép vào bàn cờ thật.

## 6. Nối dây và sàn ô caro

### 6.1 Nối dây một lần, các lần sau tự cập nhật

Importer luôn ghi ra **đúng cùng một đường dẫn** cho mỗi asset (`Assets/Art/Modern/box.png`, …). Ghi đè
một file PNG có sẵn giữ nguyên `.meta` và GUID của nó, nên mọi tham chiếu đang trỏ tới sprite đó vẫn còn
nguyên. Hệ quả: chỉ cần nối dây **một lần**.

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
| Khoá hai tông hồng | Cả magenta đậm và hồng nhạt đều thành trong suốt |
| Không xoá nhầm | Xám, nâu, đỏ, trắng, màu da đều được giữ lại |
| Dò vùng | Ảnh giả 3×3 có khe rõ → đúng 9 vùng, đúng thứ tự đọc |
| Thu vùng | Mỗi vùng thu về bounding box riêng, không dính lề của hàng/cột |
| Lọc watermark | Một đốm nhỏ ngoài lưới bị loại theo ngưỡng diện tích |
| Khử ám | Pixel mép nửa hồng bị kéo về màu hàng xóm; pixel giữa vật thể không bị đụng |
| Downsample | Vùng 8×8 một màu → ra đúng màu đó; pixel trong suốt không kéo màu lem sang pixel đục |
| Canvas: tile | `wall` và `floor` phủ kín 64×64, không còn pixel trong suốt nào |
| Canvas: vật thể | Căn giữa, **giữ đúng tỉ lệ khung hình**, và **đúng tỉ lệ so với ô tường** (vật cao 0.5 ô ra đúng 32/64 px) |
| Làm tối | `Scale(0.5)` cho đúng nửa độ sáng và **không đụng alpha** |
| Tint | Phủ tint giữ nguyên alpha, pixel trong suốt vẫn trong suốt |

## 8. Prompt cho Gemini

Lưu trong spec để lần sau tạo lại art không phải nghĩ lại. Ràng buộc: sheet vuông, lưới có khe hở rõ,
nền hồng đặc kể cả trong khe, nhìn thẳng từ trên xuống, không bóng đổ tràn ra nền, **4 hướng nhân vật
phải thật sự khác nhau** (down thấy mặt, up chỉ thấy đỉnh mũ và lưng, left/right là nghiêng mặt), và
**xuất ở độ phân giải cao nhất, tải file về chứ không chụp màn hình**.

## 9. Ngoài phạm vi

Đã cân nhắc và loại theo yêu cầu người dùng:

- Bóng đổ mềm dưới cả bàn cờ.
- Dải nền sáng hơn chạy sau bàn cờ.
- Xoá hoặc sửa `ClassicTileGenerator` và `Assets/Art/Classic/`.

## 10. Rủi ro đã biết

**Chất lượng cuối phụ thuộc gần như hoàn toàn vào ảnh Gemini trả về.** Đường ống nhập chỉ cắt và chuẩn
hoá, không sửa được nét vẽ.

Sheet đầu tiên lộ ba lỗi mà đường ống không tự chữa được. Trạng thái hiện tại:

| Lỗi | Trạng thái |
|---|---|
| Ảnh là chụp màn hình JPEG 472×1024 | **Đã xong** — người dùng cấp bản tải gốc `ArtSource/Gemini_Generated_Image_pq5cgypq5cgypq5c.png`, PNG 1408×3054 RGBA |
| Hộp-trên-đích vẽ khác hộp thường | **Đã xử lý bằng code** — sinh từ hộp thường + tint (3.6) |
| Thiếu hướng nhân vật nhìn từ sau lưng | **Còn treo** — ô hàng 3 cột 1 vẫn là bản lặp của hướng down, cần Gemini vẽ lại đúng ô đó |

Importer phải chạy được và báo lỗi rõ ràng khi thiếu `player_up`, chứ không nhận bừa ô lặp.

Nếu Gemini xếp lưới lệch tới mức dò khe không ra đủ vùng, editor window có chế độ lưới chỉnh tay làm
đường lui.
