# Thiết kế: Game Sokoban (Unity, WebGL)

Ngày: 2026-07-28

## 1. Mục tiêu

Một game Sokoban hoàn chỉnh chạy trên trình duyệt: đủ luật chơi chuẩn, undo/redo không giới hạn,
bộ màn Microban 155 màn, màn hình chọn màn có lưu tiến độ, animation di chuyển mượt, âm thanh,
và một level editor chạy trong Unity Editor để tự tạo/sửa màn.

Thành công khi: mở link WebGL, chọn màn, chơi trọn Microban từ màn 1 tới màn 155, tiến độ được nhớ
sau khi đóng trình duyệt, và toàn bộ luật chơi được test tự động phủ.

## 2. Bối cảnh kỹ thuật

- Unity **2021.3.43f1** (đã cài, cùng bản với project Sputnika), template **2D (Built-in Render Pipeline)**.
- Module WebGL đã có sẵn trong bản cài này.
- Project đã được tạo bằng Unity Hub tại **`D:\Hung\Sokoban`** (đã xác nhận: 2021.3.43f1, template 2D
  với `com.unity.feature.2d`, có `com.unity.test-framework` và module `tilemap`). Repo git và `docs/`
  nằm ngay tại thư mục gốc đó. Cần cài thêm package **MCP for Unity** để Claude thao tác trực tiếp
  lên scene/asset.
- Input dùng **Input Manager cũ** (`UnityEngine.Input`) — không thêm package Input System, tránh
  cấu hình dư thừa cho một game chỉ cần 4 hướng.
- **Quy ước MCP: chỉ mở một Unity Editor tại một thời điểm.** MCP server dùng chung endpoint
  `http://127.0.0.1:8080/mcp` cho mọi project, và URL này nằm ở EditorPrefs dùng chung toàn máy
  (`HKCU\Software\Unity Technologies\Unity Editor 5.x` → `MCPForUnity.HttpUrl`) nên **không tách được
  cổng riêng cho từng project**. Vì vậy khi làm Sokoban thì đóng Editor của Sputnika. Bản thân server
  có phân luồng theo phiên (`set_active_instance` với `Name@hash`) và sẽ báo lỗi thay vì đoán bừa khi
  có nhiều instance, nhưng đóng bớt Editor là cách chắc chắn nhất.

## 3. Quyết định kiến trúc

Hướng đã chọn: **Tilemap + ScriptableObject**.

- Phần tĩnh của màn (tường, nền, ô đích) vẽ bằng Unity Tilemap.
- Màn chơi lưu dưới dạng ScriptableObject asset, không phải file text rời.
- Người chơi và hộp là GameObject riêng, không phải tile — vì Tilemap không tween được từng ô,
  mà yêu cầu có animation di chuyển mượt.
- Luật chơi chạy trên một lưới trong bộ nhớ dựng lúc load màn. **Không** đọc/ghi trực tiếp Tilemap
  mỗi nước đi: undo, redo và animation đều cần trạng thái logic tách khỏi trạng thái hiển thị.

Hai hướng đã cân nhắc và loại:

- *Core C# thuần tách hẳn khỏi Unity*: test dễ nhất, nhưng người dùng chọn hướng bám Unity hơn.
- *Mỗi ô một MonoBehaviour tự hỏi hàng xóm*: dựng nhanh nhưng undo phải khôi phục Transform nên
  dễ lệch, và test buộc phải chạy PlayMode.

## 4. Dữ liệu màn chơi

### 4.1 Định dạng ký tự (chuẩn Sokoban)

| Ký tự | Ý nghĩa            |
|-------|--------------------|
| `#`   | Tường              |
| ` `   | Nền trống          |
| `@`   | Người chơi         |
| `+`   | Người chơi trên đích |
| `$`   | Hộp                |
| `*`   | Hộp trên đích      |
| `.`   | Ô đích             |

### 4.2 Asset

`LevelData` — class `[Serializable]`, không phải asset riêng:

- `string name`
- `int width`, `int height`
- `string[] rows` — mỗi phần tử là một hàng ký tự, đã pad cho bằng `width`

`LevelCollection` — ScriptableObject chứa `List<LevelData> levels` + `string collectionName`.

Toàn bộ Microban nằm trong **một** asset `Assets/Levels/Microban.asset` (155 phần tử), không phải
155 file rời: dễ sắp thứ tự, dễ diff, và level select chỉ cần nạp một asset.

### 4.3 Import

`MicrobanImporter` — script editor, đọc file `.txt` định dạng Microban (các màn cách nhau bằng dòng
trống, dòng bắt đầu bằng `;` là chú thích/tên màn) và sinh hoặc cập nhật một `LevelCollection`.

Màn nào sai định dạng thì ghi lỗi kèm số dòng và **bỏ qua riêng màn đó**, phần còn lại vẫn import
bình thường — một file nguồn hỏng một chỗ không được làm hỏng cả collection.

## 5. Mô hình lúc chạy

- **`Board`** — trạng thái một màn đang chơi:
  - `CellType[,] statics` (Wall / Floor / Goal) dựng một lần lúc load, không đổi trong màn
  - `Vector2Int playerPos`
  - `HashSet<Vector2Int> boxes`
  - `bool IsSolved` — đúng khi mọi toạ độ trong `boxes` đều ứng với ô `Goal` trong `statics`
- **`MoveResolver`** — hàm thuần: `(Board, Direction) → MoveResult`. `MoveResult` cho biết nước đi bị
  chặn / chỉ đi / có đẩy, kèm toạ độ cũ và mới của người chơi và của hộp bị đẩy.
- **`MoveHistory`** — stack các `Move` (hướng + có đẩy hay không). Undo đảo ngược nước đi cuối
  (lùi người chơi, và nếu là nước đẩy thì kéo hộp về). Redo đẩy lại từ nhánh đã undo. Đi một nước
  mới sẽ **xoá nhánh redo**.
- **`GameSession`** — gói `Board` + `MoveHistory` + bộ đếm `moves` / `pushes`, phát sự kiện khi
  trạng thái đổi để lớp hiển thị bám theo.

Tất cả đều là class C# thường (dùng `Vector2Int` của Unity cho tiện, nhưng không cần scene), nên
test được bằng EditMode.

### 5.1 Luật chơi

- Người chơi đi được vào ô Floor hoặc Goal không có hộp.
- Đẩy được khi ô kế tiếp theo cùng hướng là Floor hoặc Goal và không có hộp khác — nghĩa là **không
  đẩy được hai hộp liền nhau**, và không đẩy hộp vào tường.
- Thắng khi mọi hộp đều nằm trên ô đích. Số hộp luôn bằng số đích (được validator bảo đảm).
- Đẩy một hộp đang đúng đích ra ngoài thì mất trạng thái thắng — trạng thái thắng luôn tính lại từ
  bàn cờ, không phải đếm tăng giảm.

## 6. Hiển thị

- **`FloorTilemap`** — nền và ô đích. **`WallTilemap`** — tường. Cả hai vẽ một lần lúc load màn từ
  các `Tile` asset cắt từ **Kenney Sokoban Pack** (CC0).
- **`BoardRenderer`** — xoá và vẽ lại hai Tilemap theo `LevelData`, rồi spawn người chơi và các hộp
  từ object pool. Hộp đổi sprite khi nằm trên đích.
- **`MoveAnimator`** — tween vị trí người chơi/hộp khoảng **0.12 giây** mỗi ô. Trong lúc tween chạy,
  input tiếp theo được **đệm tối đa 1 nước** rồi thực thi ngay khi tween xong, để giữ nhịp khi người
  chơi giữ phím. Undo/redo dùng cùng animation, hướng ngược lại.
- **Camera** — orthographic, tự canh `orthographicSize` và vị trí theo kích thước màn cộng lề, để
  màn nhỏ không lọt thỏm giữa màn hình và màn lớn không bị cắt.

## 7. Điều khiển

`InputRouter` gom mọi nguồn input thành một luồng `Direction` + lệnh:

- Bàn phím: mũi tên hoặc WASD để đi, `U` undo, `Y` redo, `R` restart, `Esc` thoát về LevelSelect
  (giống hệt nút Thoát trên HUD — không có màn hình tạm dừng riêng).
- Cảm ứng: vuốt theo 4 hướng, ngưỡng khoảng cách tối thiểu để không nhầm với chạm nhẹ; trục nào
  vuốt dài hơn thì thắng.
- Nút trên màn hình: Undo, Redo, Restart, Thoát — bấm được bằng cả chuột lẫn ngón tay.

## 8. Luồng game và UI

Một scene duy nhất `Main.unity` với các panel bật/tắt — WebGL load scene chậm nên tránh chia nhiều
scene. `GameFlowController` giữ trạng thái hiện tại và điều phối panel.

- **MainMenu** — Chơi tiếp (vào màn dở dang gần nhất), Chọn màn, bật/tắt tiếng, hướng dẫn ngắn.
- **LevelSelect** — lưới nút số màn; màn đã qua có dấu tick và số bước tốt nhất; màn chưa mở khoá
  hiển thị mờ và không bấm được. Mở khoá **tuần tự**: qua màn *n* mới mở màn *n+1*; màn 1 luôn mở.
- **HUD trong màn** — tên màn, số bước, số lần đẩy, và hàng nút Undo · Redo · Restart · Thoát.
- **LevelComplete** — số bước lượt này, kỷ lục cũ (nếu có), nút Màn tiếp / Chơi lại / Chọn màn.
  Ở màn cuối cùng của collection, nút Màn tiếp bị ẩn và panel hiện lời chúc mừng hoàn thành bộ màn.

## 9. Lưu tiến độ

`ProgressStore` ghi một chuỗi JSON vào `PlayerPrefs` (trên WebGL, Unity tự lưu xuống IndexedDB).

Nội dung: theo từng collection, với mỗi chỉ số màn lưu `completed`, `bestMoves`, `bestPushes`, cộng
với `lastPlayedIndex` để nút "Chơi tiếp" biết vào đâu.

JSON hỏng hoặc thiếu trường thì **reset về rỗng và ghi cảnh báo**, không ném lỗi làm treo game.

## 10. Âm thanh

`AudioService` phát SFX bước chân, đẩy hộp, hộp vào đích, thắng màn, undo; kèm một track nhạc nền
lặp. Nút tắt tiếng lưu theo máy cùng chỗ với tiến độ.

Trình duyệt chặn audio trước thao tác đầu tiên của người dùng, nên nhạc nền chỉ bắt đầu từ lần bấm
đầu tiên chứ không phát ngay lúc load.

Nguồn âm thanh: SFX CC0.

## 11. Level editor cho dev

`LevelCollectionWindow` — một `EditorWindow`:

- Chọn một `LevelCollection`, xem danh sách màn, thêm / xoá / đổi thứ tự.
- Vẽ màn trên lưới bằng bảng cọ: tường, nền, đích, hộp, người chơi, xoá. Đổi được kích thước lưới.
- Nút **Kiểm tra** bắt các lỗi: không đúng một người chơi, số hộp khác số đích, vùng chơi hở không
  có tường bao kín, hộp hoặc người nằm ngoài vùng chơi.
- Nút **Import .txt** dùng lại đúng parser của `MicrobanImporter`.

Editor này chỉ kiểm tra tính hợp lệ về cấu trúc, **không** kiểm tra màn có giải được hay không —
viết solver Sokoban là một bài toán riêng, nằm ngoài phạm vi spec này.

## 12. Test

Test EditMode bằng Unity Test Framework, nhắm vào `Board`, `MoveResolver`, `MoveHistory` và parser:

- Đi vào ô trống, đi vào tường (bị chặn), đẩy hộp hợp lệ, đẩy hộp vào tường (bị chặn), đẩy vào hộp
  khác (bị chặn).
- Thắng khi mọi hộp phủ hết đích; đẩy một hộp đang đúng đích ra ngoài thì mất trạng thái thắng.
- Undo khôi phục đúng trạng thái trước đó, kể cả nước đẩy; undo hết về đầu màn trùng khớp trạng thái
  ban đầu; redo lặp lại đúng nước đã undo; đi nước mới thì xoá nhánh redo.
- Parser: đọc đúng cả 7 ký tự, pad hàng ngắn, báo lỗi có số dòng với đầu vào hỏng.
- Hồi quy: parse toàn bộ 155 màn Microban và khẳng định mọi màn hợp lệ (đúng một người chơi, số hộp
  bằng số đích); chạy lời giải của vài màn đầu và kiểm tra kết thúc ở trạng thái thắng. Lời giải lấy
  từ file solution công khai của Microban nếu tải được; nếu không, tự giải tay 3–5 màn đầu và ghi
  chuỗi nước đi thẳng vào test — không bỏ qua nhóm test này.

## 13. Xử lý lỗi

- Level text sai định dạng → báo lỗi kèm số dòng, bỏ qua màn đó, giữ nguyên phần còn lại.
- Thiếu tile asset khi vẽ → ghi lỗi rõ ràng và vẽ ô placeholder màu hồng thay vì im lặng bỏ trống.
- PlayerPrefs hỏng → reset tiến độ về rỗng kèm cảnh báo.
- Level rỗng hoặc `LevelCollection` không có màn nào → LevelSelect hiện thông báo thay vì màn hình trắng.

## 14. Rủi ro

- **Tải asset ngoài**: Kenney Sokoban Pack và file `.txt` Microban đều phải tải từ mạng. Nếu môi
  trường chặn tải, dừng lại và nhờ người dùng tải thủ công — **không** tự bịa asset thay thế.
- **MCP for Unity chưa cài**: `Packages/manifest.json` hiện chưa có package này, nên Claude chưa
  thao tác trực tiếp lên scene/asset được. Phải cài xong trước khi bắt đầu mốc 1 — dùng đúng bản
  Sputnika đang chạy: `"com.coplaydev.unity-mcp": "https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#v10.0.0"`.
- **Scene thừa**: `Assets/Scenes/` đang có cả `SampleScene.unity` lẫn `New Scene.unity`. Mốc 1 sẽ dọn
  còn đúng một scene `Main.unity`.

## 15. Ngoài phạm vi

Không làm trong spec này: in-game level editor cho người chơi, solver tự động / gợi ý nước đi, sinh
màn ngẫu nhiên, bảng xếp hạng online, đa ngôn ngữ, và build cho nền tảng ngoài WebGL.

## 16. Mốc triển khai

1. Dựng project, import art Kenney, tạo `LevelCollection` + importer Microban, test parser.
2. Vẽ màn bằng Tilemap, di chuyển và đẩy hộp, phát hiện thắng màn, test luật chơi.
3. Undo / redo, bộ đếm bước và đẩy, restart.
4. Animation di chuyển mượt và đệm input.
5. UI: MainMenu, LevelSelect, HUD, LevelComplete, lưu tiến độ.
6. Âm thanh và nút tắt tiếng.
7. `LevelCollectionWindow` — level editor cho dev.
8. Build WebGL và chỉnh sửa cuối.
