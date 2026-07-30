# Modern Art Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cắt sprite sheet pixel art do Gemini vẽ thành 10 sprite rời, sinh thêm biến thể bằng code, và nối vào game thay cho bộ art sinh bằng thuật toán hiện tại.

**Architecture:** Ba lớp tách bạch. `PixelBuffer` + `SpriteSheetSlicer` là C# thuần trên mảng `Color32`, không đụng `AssetDatabase` hay `Texture2D`, nên test EditMode chạy thẳng vào được. `ModernArtImporter` là lớp duy nhất đụng Unity: đọc file, gọi slicer, ghi PNG, đặt import setting, tạo Tile asset. `ModernArtImporterWindow` chỉ là mặt tiền để xem trước và chỉnh hằng số. Runtime chỉ đổi đúng một chỗ: `BoardRenderer` chọn tile sàn xen kẽ theo `(x + y) % 2`.

**Tech Stack:** Unity 2021.3.43f1, C# 9, `UnityEngine.Tilemaps`, `ImageConversion` (PNG encode/decode), Unity Test Framework EditMode, NUnit.

**Spec:** [`docs/superpowers/specs/2026-07-30-modern-art-import-design.md`](../specs/2026-07-30-modern-art-import-design.md)

## Global Constraints

Mọi task đều ngầm chịu các ràng buộc sau.

- **Unity 2021.3.43f1**, project tại `D:\Hung\Sokoban`. Không nâng version, không đổi render pipeline.
- **Chỉ mở một Unity Editor tại một thời điểm.** Trước khi dùng tool MCP, đọc `mcpforunity://instances` và xác nhận chỉ có `Sokoban@...`.
- **`PixelBuffer` dùng thứ tự ảnh: `y = 0` là hàng TRÊN CÙNG.** `Texture2D.GetPixels32` của Unity thì `y = 0` là hàng DƯỚI CÙNG. Việc lật nằm gọn trong hai hàm `FromTexture` và `ToTexture` — không lật ở bất kỳ chỗ nào khác. Sai chỗ này là cả sheet bị đảo ngược và ánh xạ ô → asset lệch hết hàng.
- **Thứ tự đọc vùng** là trái→phải rồi trên→dưới, đúng như mắt người nhìn tấm sheet.
- **Cỡ sprite đầu ra 64×64, PPU 64**, `FilterMode.Point`, uncompressed, `alphaIsTransparency = true`, không mipmap. Trùng đúng thiết lập bộ art `Classic` hiện tại nên không phải chỉnh camera, prefab hay level data.
- **Không đụng `Assets/Art/Classic/` và `ClassicTileGenerator.cs`.** Art mới ghi vào `Assets/Art/Modern/`.
- **Ảnh nguồn** nằm ở `ArtSource/` ngoài `Assets/`. Hiện có `ArtSource/Gemini_Generated_Image_pq5cgypq5cgypq5c.png` (PNG 1408×3054 RGBA). Importer lấy file ảnh **mới nhất** trong thư mục, không đòi tên cố định.
- **Chạy test**: MCP tool `run_tests` với `mode: "EditMode"`, hoặc Window → General → Test Runner. Sau mỗi lần compile gọi `read_console` và chắc chắn 0 lỗi trước khi đi tiếp.
- **Commit thường xuyên**, mỗi task ít nhất một commit. Không dùng `git add -A` — luôn stage đúng đường dẫn đã đổi.
- **Số đo đã xác minh trên ảnh nguồn hiện tại** (dùng để kiểm tra kết quả, không hard-code vào code): 9 vùng; ô tường `(16, 794)` cỡ `439×467`; sàn `436×467`; đích `341×362`; hộp `289×387`; bốn nhân vật quanh `205×377`. Độ sáng trung bình tường 124.2, sàn 134.5.

---

### Task 1: `PixelBuffer` và nhận diện nền

**Files:**
- Create: `Assets/Editor/PixelBuffer.cs`
- Create: `Assets/Editor/SpriteSheetSlicer.cs`
- Create: `Assets/Tests/EditMode/SpriteSheetSlicerTests.cs`
- Modify: `Assets/Tests/EditMode/Sokoban.Tests.EditMode.asmdef`

**Interfaces:**
- Produces: `Sokoban.EditorTools.PixelBuffer` với `Width`, `Height`, `Pixels`, `Get(x,y)`, `Set(x,y,c)`, `Inside(x,y)`; và `SpriteSheetSlicer.IsBackground(Color32 c, int tolerance)`.

- [ ] **Step 1: Cho assembly test thấy được assembly Editor**

Sửa `Assets/Tests/EditMode/Sokoban.Tests.EditMode.asmdef`, thêm `"Sokoban.Editor"` vào `references`:

```json
    "references": [
        "Sokoban.Runtime",
        "Sokoban.Editor",
        "UnityEngine.TestRunner",
        "UnityEditor.TestRunner"
    ],
```

Giữ nguyên mọi trường khác. `Sokoban.Editor` đã có `includePlatforms: [ "Editor" ]` và assembly test cũng vậy, nên không xung đột nền tảng.

- [ ] **Step 2: Viết test thất bại**

Tạo `Assets/Tests/EditMode/SpriteSheetSlicerTests.cs`:

```csharp
using NUnit.Framework;
using Sokoban.EditorTools;
using UnityEngine;

namespace Sokoban.Tests
{
    public class SpriteSheetSlicerTests
    {
        const int Tol = 25;

        static Color32 C(int r, int g, int b) => new Color32((byte)r, (byte)g, (byte)b, 255);

        [Test]
        public void MagentaOuterBackground_IsBackground()
        {
            Assert.IsTrue(SpriteSheetSlicer.IsBackground(C(253, 31, 252), Tol));
        }

        [Test]
        public void LightPinkCellBackground_IsBackground()
        {
            Assert.IsTrue(SpriteSheetSlicer.IsBackground(C(255, 127, 255), Tol));
        }

        [Test]
        public void ArtColours_AreNotBackground()
        {
            Assert.IsFalse(SpriteSheetSlicer.IsBackground(C(140, 140, 140), Tol), "đá xám");
            Assert.IsFalse(SpriteSheetSlicer.IsBackground(C(255, 255, 255), Tol), "sơ mi trắng");
            Assert.IsFalse(SpriteSheetSlicer.IsBackground(C(150, 100, 60), Tol), "gỗ nâu");
            Assert.IsFalse(SpriteSheetSlicer.IsBackground(C(200, 40, 40), Tol), "vòng đích đỏ");
            Assert.IsFalse(SpriteSheetSlicer.IsBackground(C(230, 180, 140), Tol), "màu da");
            Assert.IsFalse(SpriteSheetSlicer.IsBackground(C(30, 30, 34), Tol), "vest đen");
        }

        [Test]
        public void PixelBuffer_RoundTripsPixels()
        {
            var buf = new PixelBuffer(3, 2);
            buf.Set(2, 1, C(10, 20, 30));

            Assert.AreEqual(6, buf.Pixels.Length);
            Assert.AreEqual(10, buf.Get(2, 1).r);
            Assert.AreEqual(20, buf.Get(2, 1).g);
            Assert.IsFalse(buf.Inside(3, 0));
            Assert.IsTrue(buf.Inside(0, 0));
        }
    }
}
```

- [ ] **Step 3: Chạy test, xác nhận nó fail**

Chạy: MCP `run_tests` với `mode: "EditMode"`, `testFilter: "SpriteSheetSlicerTests"`
Kỳ vọng: FAIL do lỗi biên dịch — chưa có type `PixelBuffer` và `SpriteSheetSlicer`.

- [ ] **Step 4: Viết `PixelBuffer`**

Tạo `Assets/Editor/PixelBuffer.cs`:

```csharp
using UnityEngine;

namespace Sokoban.EditorTools
{
    /// <summary>
    /// Ảnh RGBA thuần trong bộ nhớ. Tách khỏi Texture2D để logic cắt sheet test được
    /// mà không cần GPU. Quy ước y = 0 là hàng TRÊN CÙNG, ngược với Texture2D của Unity.
    /// </summary>
    public class PixelBuffer
    {
        public readonly int Width;
        public readonly int Height;
        public readonly Color32[] Pixels;

        public PixelBuffer(int width, int height)
        {
            Width = width;
            Height = height;
            Pixels = new Color32[width * height];
        }

        public Color32 Get(int x, int y) => Pixels[y * Width + x];

        public void Set(int x, int y, Color32 c) => Pixels[y * Width + x] = c;

        public bool Inside(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height;
    }
}
```

- [ ] **Step 5: Viết `IsBackground`**

Tạo `Assets/Editor/SpriteSheetSlicer.cs`:

```csharp
using UnityEngine;

namespace Sokoban.EditorTools
{
    /// <summary>
    /// Cắt sprite sheet thành từng vùng và làm sạch pixel. Toàn bộ là C# thuần trên
    /// PixelBuffer — không gọi AssetDatabase, không đọc ghi file.
    /// </summary>
    public static class SpriteSheetSlicer
    {
        /// <summary>
        /// Nền của sheet là hai tông hồng: magenta đậm bao ngoài và hồng nhạt trong từng ô.
        /// Bắt cả hai bằng phép thử "độ magenta": đỏ và lam đều cao, lục thấp hẳn.
        /// Không bắt nhầm art vì đá xám có r≈g≈b, gỗ và đỏ có lam thấp, trắng có lục không thấp.
        /// </summary>
        public static bool IsBackground(Color32 c, int tolerance)
        {
            int lo = Mathf.Min(c.r, c.b);
            return c.r > 180 && c.b > 180 && c.g < lo - tolerance;
        }
    }
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Chạy: MCP `run_tests`, `mode: "EditMode"`, `testFilter: "SpriteSheetSlicerTests"`
Kỳ vọng: 4 test PASS. Gọi `read_console` xác nhận 0 lỗi biên dịch.

- [ ] **Step 7: Commit**

```bash
git add Assets/Editor/PixelBuffer.cs Assets/Editor/PixelBuffer.cs.meta \
        Assets/Editor/SpriteSheetSlicer.cs Assets/Editor/SpriteSheetSlicer.cs.meta \
        Assets/Tests/EditMode/SpriteSheetSlicerTests.cs Assets/Tests/EditMode/SpriteSheetSlicerTests.cs.meta \
        Assets/Tests/EditMode/Sokoban.Tests.EditMode.asmdef
git commit -m "Add a pixel buffer and magenta background detection for sheet slicing"
```

---

### Task 2: Dò vùng trên sheet

**Files:**
- Modify: `Assets/Editor/SpriteSheetSlicer.cs`
- Modify: `Assets/Tests/EditMode/SpriteSheetSlicerTests.cs`

**Interfaces:**
- Consumes: `PixelBuffer`, `SpriteSheetSlicer.IsBackground` từ Task 1.
- Produces: `SpriteSheetSlicer.FindRegions(PixelBuffer src, int tolerance, float gutterRatio, float minAreaRatio)` trả `List<RectInt>` theo thứ tự đọc; `SpriteSheetSlicer.Crop(PixelBuffer src, RectInt r)` trả `PixelBuffer`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `SpriteSheetSlicerTests.cs` — trước hết là hai helper dựng ảnh giả, đặt ngay dưới hàm `C`:

```csharp
        static readonly Color32 Bg = new Color32(253, 31, 252, 255);
        static readonly Color32 Art = new Color32(140, 140, 140, 255);

        static void Fill(PixelBuffer buf, RectInt r, Color32 col)
        {
            for (int y = r.yMin; y < r.yMax; y++)
                for (int x = r.xMin; x < r.xMax; x++)
                    if (buf.Inside(x, y))
                        buf.Set(x, y, col);
        }

        /// <summary>Sheet giả: lưới cols x rows ô đặc, cách nhau và viền ngoài đều bằng gutter.</summary>
        static PixelBuffer Grid(int cell, int gutter, int cols, int rows)
        {
            var buf = new PixelBuffer(cols * cell + (cols + 1) * gutter,
                                      rows * cell + (rows + 1) * gutter);
            for (int i = 0; i < buf.Pixels.Length; i++) buf.Pixels[i] = Bg;

            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                    Fill(buf, new RectInt(gutter + c * (cell + gutter),
                                          gutter + r * (cell + gutter), cell, cell), Art);
            return buf;
        }
```

Rồi các test:

```csharp
        [Test]
        public void FindRegions_ReturnsOneRectPerCell_InReadingOrder()
        {
            var sheet = Grid(cell: 30, gutter: 6, cols: 3, rows: 3);

            var regions = SpriteSheetSlicer.FindRegions(sheet, Tol, 0.985f, 0.25f);

            Assert.AreEqual(9, regions.Count);
            Assert.AreEqual(new RectInt(6, 6, 30, 30), regions[0], "ô đầu là trên-trái");
            Assert.AreEqual(new RectInt(42, 6, 30, 30), regions[1], "ô thứ hai sang phải, chưa xuống hàng");
            Assert.AreEqual(new RectInt(6, 42, 30, 30), regions[3], "ô thứ tư mới xuống hàng");
        }

        [Test]
        public void FindRegions_TightensEachCellToItsOwnContent()
        {
            var sheet = Grid(cell: 30, gutter: 6, cols: 2, rows: 1);
            // Ô thứ hai chỉ có một chấm nhỏ 10x10 nằm giữa, phần còn lại trả về nền.
            Fill(sheet, new RectInt(42, 6, 30, 30), Bg);
            Fill(sheet, new RectInt(52, 16, 10, 10), Art);

            var regions = SpriteSheetSlicer.FindRegions(sheet, Tol, 0.985f, 0.05f);

            Assert.AreEqual(2, regions.Count);
            Assert.AreEqual(new RectInt(52, 16, 10, 10), regions[1],
                "vùng phải ôm sát nội dung của chính nó, không lấy cả bề rộng hàng");
        }

        [Test]
        public void FindRegions_DropsSpecksLikeTheGeminiWatermark()
        {
            var sheet = Grid(cell: 30, gutter: 6, cols: 3, rows: 3);
            // Watermark nằm ở lề dưới, ngoài lưới, nhỏ hơn hẳn các ô thật.
            Fill(sheet, new RectInt(100, 112, 5, 5), Art);

            var regions = SpriteSheetSlicer.FindRegions(sheet, Tol, 0.985f, 0.25f);

            Assert.AreEqual(9, regions.Count, "đốm nhỏ ngoài lưới phải bị loại theo ngưỡng diện tích");
        }

        [Test]
        public void Crop_CopiesExactlyTheRect()
        {
            var sheet = Grid(cell: 30, gutter: 6, cols: 1, rows: 1);

            var cell = SpriteSheetSlicer.Crop(sheet, new RectInt(6, 6, 30, 30));

            Assert.AreEqual(30, cell.Width);
            Assert.AreEqual(30, cell.Height);
            Assert.AreEqual(Art.r, cell.Get(0, 0).r);
            Assert.AreEqual(Art.r, cell.Get(29, 29).r);
        }
```

- [ ] **Step 2: Chạy test, xác nhận nó fail**

Chạy: MCP `run_tests`, `mode: "EditMode"`, `testFilter: "SpriteSheetSlicerTests"`
Kỳ vọng: FAIL do chưa có `FindRegions` và `Crop`.

- [ ] **Step 3: Viết `FindRegions` và `Crop`**

Thêm `using System.Collections.Generic;` và `using System.Linq;` ở đầu `SpriteSheetSlicer.cs`, rồi thêm vào lớp:

```csharp
        /// <summary>
        /// Dò khe thay vì chia lưới cứng: Gemini xếp ô lệch nhau nên công thức width/cols
        /// sẽ cắt cụt hoặc dính sang ô bên. Tìm các hàng và cột gần như toàn nền để lấy
        /// biên thô, rồi thu từng ô về bounding box của riêng nó.
        /// </summary>
        public static List<RectInt> FindRegions(PixelBuffer src, int tolerance,
                                                float gutterRatio, float minAreaRatio)
        {
            var rows = Bands(src.Height, y => BackgroundRatioInRow(src, y, tolerance), gutterRatio);
            var cols = Bands(src.Width, x => BackgroundRatioInColumn(src, x, tolerance), gutterRatio);

            var found = new List<RectInt>();
            foreach (var row in rows)
                foreach (var col in cols)
                    if (Tighten(src, col, row, tolerance, out var rect))
                        found.Add(rect);

            return DropSpecks(found, minAreaRatio);
        }

        public static PixelBuffer Crop(PixelBuffer src, RectInt r)
        {
            var dst = new PixelBuffer(r.width, r.height);
            for (int y = 0; y < r.height; y++)
                for (int x = 0; x < r.width; x++)
                    dst.Set(x, y, src.Get(r.xMin + x, r.yMin + y));
            return dst;
        }

        static float BackgroundRatioInRow(PixelBuffer src, int y, int tolerance)
        {
            int n = 0;
            for (int x = 0; x < src.Width; x++)
                if (IsBackground(src.Get(x, y), tolerance)) n++;
            return (float)n / src.Width;
        }

        static float BackgroundRatioInColumn(PixelBuffer src, int x, int tolerance)
        {
            int n = 0;
            for (int y = 0; y < src.Height; y++)
                if (IsBackground(src.Get(x, y), tolerance)) n++;
            return (float)n / src.Height;
        }

        /// <summary>Các đoạn liên tiếp mà tỉ lệ nền chưa đạt ngưỡng, tức là có nội dung.</summary>
        static List<Vector2Int> Bands(int length, System.Func<int, float> ratioAt, float gutterRatio)
        {
            var bands = new List<Vector2Int>();
            int start = -1;

            for (int i = 0; i < length; i++)
            {
                bool content = ratioAt(i) < gutterRatio;
                if (content && start < 0) start = i;
                else if (!content && start >= 0) { bands.Add(new Vector2Int(start, i - 1)); start = -1; }
            }
            if (start >= 0) bands.Add(new Vector2Int(start, length - 1));

            return bands;
        }

        static bool Tighten(PixelBuffer src, Vector2Int col, Vector2Int row, int tolerance,
                            out RectInt rect)
        {
            int x0 = int.MaxValue, x1 = int.MinValue, y0 = int.MaxValue, y1 = int.MinValue;

            for (int y = row.x; y <= row.y; y++)
                for (int x = col.x; x <= col.y; x++)
                {
                    if (IsBackground(src.Get(x, y), tolerance)) continue;
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }

            if (x0 > x1) { rect = default; return false; }

            rect = new RectInt(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
            return true;
        }

        /// <summary>
        /// Loại các vùng nhỏ bất thường so với phần còn lại — watermark của Gemini ở góc
        /// dưới phải nằm ngoài lưới nhưng vẫn là nội dung, nếu không lọc sẽ thành một ô giả.
        /// </summary>
        static List<RectInt> DropSpecks(List<RectInt> regions, float minAreaRatio)
        {
            if (regions.Count < 3) return regions;

            var areas = regions.Select(r => (long)r.width * r.height).OrderBy(a => a).ToList();
            long median = areas[areas.Count / 2];

            return regions.Where(r => (long)r.width * r.height >= median * minAreaRatio).ToList();
        }
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Chạy: MCP `run_tests`, `mode: "EditMode"`, `testFilter: "SpriteSheetSlicerTests"`
Kỳ vọng: 8 test PASS.

- [ ] **Step 5: Commit**

```bash
git add Assets/Editor/SpriteSheetSlicer.cs Assets/Tests/EditMode/SpriteSheetSlicerTests.cs
git commit -m "Find sheet regions by scanning for background gutters"
```

---

### Task 3: Làm sạch pixel — tách nền, khử ám, thu nhỏ

**Files:**
- Modify: `Assets/Editor/SpriteSheetSlicer.cs`
- Modify: `Assets/Tests/EditMode/SpriteSheetSlicerTests.cs`

**Interfaces:**
- Consumes: `PixelBuffer`, `IsBackground`, `Crop` từ Task 1–2.
- Produces: `KeyOut(PixelBuffer src, int tolerance)` trả `PixelBuffer` mới; `Despill(PixelBuffer buf, int band, int tolerance)` sửa tại chỗ; `Resample(PixelBuffer src, int width, int height)` trả `PixelBuffer` mới.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `SpriteSheetSlicerTests.cs`:

```csharp
        [Test]
        public void KeyOut_ClearsBothPinkTones_AndKeepsArt()
        {
            var buf = new PixelBuffer(3, 1);
            buf.Set(0, 0, Bg);                            // magenta ngoài
            buf.Set(1, 0, new Color32(255, 127, 255, 255)); // hồng nhạt trong ô
            buf.Set(2, 0, Art);

            var keyed = SpriteSheetSlicer.KeyOut(buf, Tol);

            Assert.AreEqual(0, keyed.Get(0, 0).a);
            Assert.AreEqual(0, keyed.Get(1, 0).a);
            Assert.AreEqual(255, keyed.Get(2, 0).a);
            Assert.AreEqual(Art.r, keyed.Get(2, 0).r, "màu art không được đụng vào");
        }

        [Test]
        public void Despill_PullsPinkFringeTowardsItsNeighbour()
        {
            // [trong suốt][mép ám hồng][art]
            var buf = new PixelBuffer(3, 1);
            buf.Set(0, 0, new Color32(0, 0, 0, 0));
            buf.Set(1, 0, new Color32(200, 80, 200, 255));
            buf.Set(2, 0, Art);

            SpriteSheetSlicer.Despill(buf, band: 2, tolerance: 8);

            var fringe = buf.Get(1, 0);
            Assert.LessOrEqual(fringe.r, 88, "đỏ bị hạ về quanh mức lục");
            Assert.LessOrEqual(fringe.b, 88, "lam bị hạ về quanh mức lục");
            Assert.AreEqual(80, fringe.g, "lục giữ nguyên");
        }

        [Test]
        public void Despill_LeavesRedAndWhiteAlone()
        {
            var buf = new PixelBuffer(3, 1);
            buf.Set(0, 0, new Color32(0, 0, 0, 0));
            buf.Set(1, 0, new Color32(200, 40, 40, 255));    // vòng đích đỏ
            buf.Set(2, 0, new Color32(250, 250, 250, 255));  // sơ mi trắng

            SpriteSheetSlicer.Despill(buf, band: 2, tolerance: 8);

            Assert.AreEqual(200, buf.Get(1, 0).r);
            Assert.AreEqual(250, buf.Get(2, 0).r);
        }

        [Test]
        public void Despill_DoesNotTouchPixelsAwayFromTheEdge()
        {
            // Phải đủ rộng cả hai chiều: biên ảnh cũng bị coi là trong suốt, nên một buffer
            // cao 1 pixel thì pixel nào cũng nằm trong dải khử ám và test sẽ vô nghĩa.
            var buf = new PixelBuffer(12, 12);
            Fill(buf, new RectInt(0, 0, 12, 12), new Color32(200, 80, 200, 255));
            Fill(buf, new RectInt(0, 0, 1, 12), new Color32(0, 0, 0, 0));

            SpriteSheetSlicer.Despill(buf, band: 2, tolerance: 8);

            Assert.LessOrEqual(buf.Get(1, 6).r, 88, "pixel sát cột trong suốt thì bị khử ám");
            Assert.AreEqual(200, buf.Get(6, 6).r, "pixel giữa ảnh nằm ngoài dải khử ám");
        }

        [Test]
        public void Resample_AveragesEachBlock()
        {
            var buf = new PixelBuffer(4, 4);
            for (int i = 0; i < buf.Pixels.Length; i++) buf.Pixels[i] = new Color32(100, 100, 100, 255);
            // Một góc 2x2 sáng hơn hẳn.
            Fill(buf, new RectInt(0, 0, 2, 2), new Color32(200, 200, 200, 255));

            var small = SpriteSheetSlicer.Resample(buf, 2, 2);

            Assert.AreEqual(2, small.Width);
            Assert.AreEqual(200, small.Get(0, 0).r, "khối toàn màu sáng ra đúng màu đó");
            Assert.AreEqual(100, small.Get(1, 1).r);
        }

        [Test]
        public void Resample_DoesNotBleedColourOutOfTransparentPixels()
        {
            var buf = new PixelBuffer(2, 2);
            buf.Set(0, 0, new Color32(255, 0, 0, 255));
            buf.Set(1, 0, new Color32(0, 0, 0, 0));
            buf.Set(0, 1, new Color32(0, 0, 0, 0));
            buf.Set(1, 1, new Color32(0, 0, 0, 0));

            var small = SpriteSheetSlicer.Resample(buf, 1, 1);

            Assert.AreEqual(255, small.Get(0, 0).r, "màu lấy từ pixel đục, không bị pixel trong suốt kéo về 0");
            Assert.AreEqual(64, small.Get(0, 0).a, "alpha là trung bình thẳng của 4 pixel");
        }
```

- [ ] **Step 2: Chạy test, xác nhận nó fail**

Chạy: MCP `run_tests`, `mode: "EditMode"`, `testFilter: "SpriteSheetSlicerTests"`
Kỳ vọng: FAIL do chưa có `KeyOut`, `Despill`, `Resample`.

- [ ] **Step 3: Viết ba hàm**

Thêm vào `SpriteSheetSlicer.cs`:

```csharp
        public static PixelBuffer KeyOut(PixelBuffer src, int tolerance)
        {
            var dst = new PixelBuffer(src.Width, src.Height);
            for (int i = 0; i < src.Pixels.Length; i++)
            {
                var c = src.Pixels[i];
                dst.Pixels[i] = IsBackground(c, tolerance) ? new Color32(0, 0, 0, 0) : c;
            }
            return dst;
        }

        /// <summary>
        /// Bounding box ôm luôn các pixel khử răng cưa nằm giữa art và nền, nên mép sprite
        /// còn ám hồng. Với pixel đục nằm sát vùng trong suốt, nếu cả đỏ lẫn lam đều vượt
        /// hẳn lục thì hạ hai kênh đó xuống ngang lục. Chỉ chạm dải mép nên phần trong ruột
        /// của vật thể không bị đụng, và điều kiện "cả đỏ lẫn lam" chừa lại màu đỏ thuần
        /// của vòng đích cùng màu trắng của sơ mi.
        /// </summary>
        public static void Despill(PixelBuffer buf, int band, int tolerance)
        {
            var original = (Color32[])buf.Pixels.Clone();

            for (int y = 0; y < buf.Height; y++)
                for (int x = 0; x < buf.Width; x++)
                {
                    var c = original[y * buf.Width + x];
                    if (c.a == 0) continue;
                    if (!NearTransparent(original, buf.Width, buf.Height, x, y, band)) continue;

                    if (Mathf.Min(c.r, c.b) <= c.g + tolerance) continue;

                    byte cap = (byte)Mathf.Min(255, c.g + tolerance);
                    buf.Set(x, y, new Color32(c.r < cap ? c.r : cap, c.g, c.b < cap ? c.b : cap, c.a));
                }
        }

        static bool NearTransparent(Color32[] pixels, int width, int height, int x, int y, int band)
        {
            for (int dy = -band; dy <= band; dy++)
                for (int dx = -band; dx <= band; dx++)
                {
                    int nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
                    if (pixels[ny * width + nx].a == 0) return true;
                }
            return false;
        }

        /// <summary>
        /// Thu nhỏ bằng trung bình vùng. Màu lấy trung bình có trọng số alpha để pixel
        /// trong suốt không kéo màu của mép về đen; alpha thì lấy trung bình thẳng.
        /// </summary>
        public static PixelBuffer Resample(PixelBuffer src, int width, int height)
        {
            var dst = new PixelBuffer(width, height);

            for (int y = 0; y < height; y++)
            {
                int sy0 = y * src.Height / height;
                int sy1 = Mathf.Max(sy0 + 1, (y + 1) * src.Height / height);

                for (int x = 0; x < width; x++)
                {
                    int sx0 = x * src.Width / width;
                    int sx1 = Mathf.Max(sx0 + 1, (x + 1) * src.Width / width);

                    float r = 0f, g = 0f, b = 0f, a = 0f, weight = 0f;
                    for (int sy = sy0; sy < sy1; sy++)
                        for (int sx = sx0; sx < sx1; sx++)
                        {
                            var c = src.Get(sx, sy);
                            float w = c.a / 255f;
                            r += c.r * w; g += c.g * w; b += c.b * w;
                            a += c.a; weight += w;
                        }

                    int count = (sy1 - sy0) * (sx1 - sx0);
                    byte alpha = (byte)Mathf.RoundToInt(a / count);

                    dst.Set(x, y, weight < 0.0001f
                        ? new Color32(0, 0, 0, 0)
                        : new Color32((byte)Mathf.RoundToInt(r / weight),
                                      (byte)Mathf.RoundToInt(g / weight),
                                      (byte)Mathf.RoundToInt(b / weight), alpha));
                }
            }

            return dst;
        }
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Chạy: MCP `run_tests`, `mode: "EditMode"`, `testFilter: "SpriteSheetSlicerTests"`
Kỳ vọng: 14 test PASS.

- [ ] **Step 5: Commit**

```bash
git add Assets/Editor/SpriteSheetSlicer.cs Assets/Tests/EditMode/SpriteSheetSlicerTests.cs
git commit -m "Key out the pink background, remove its fringe, and downsample cleanly"
```

---

### Task 4: Canvas vuông và hai biến thể màu

**Files:**
- Modify: `Assets/Editor/SpriteSheetSlicer.cs`
- Modify: `Assets/Tests/EditMode/SpriteSheetSlicerTests.cs`

**Interfaces:**
- Consumes: `PixelBuffer`, `Resample` từ Task 3.
- Produces: `PlaceCentered(PixelBuffer content, int canvas)`, `Brightness(PixelBuffer src, float factor)`, `Tint(PixelBuffer src, Color32 tint, float amount)` — cả ba trả `PixelBuffer` mới; và `ObjectSize(int width, int height, float cell, int canvas, float scale)` trả `Vector2Int`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `SpriteSheetSlicerTests.cs`:

```csharp
        [Test]
        public void PlaceCentered_CentresContentOnATransparentCanvas()
        {
            var content = new PixelBuffer(2, 4);
            for (int i = 0; i < content.Pixels.Length; i++) content.Pixels[i] = Art;

            var canvas = SpriteSheetSlicer.PlaceCentered(content, 8);

            Assert.AreEqual(8, canvas.Width);
            Assert.AreEqual(8, canvas.Height);
            Assert.AreEqual(0, canvas.Get(0, 0).a, "góc canvas phải trong suốt");
            Assert.AreEqual(255, canvas.Get(3, 2).a, "nội dung nằm ở giữa");
            Assert.AreEqual(255, canvas.Get(4, 5).a);
            Assert.AreEqual(0, canvas.Get(3, 1).a, "trên nội dung là lề trong suốt");
        }

        [Test]
        public void Brightness_ScalesColourButNotAlpha()
        {
            var buf = new PixelBuffer(2, 1);
            buf.Set(0, 0, new Color32(200, 100, 50, 255));
            buf.Set(1, 0, new Color32(200, 100, 50, 0));

            var dim = SpriteSheetSlicer.Brightness(buf, 0.5f);

            Assert.AreEqual(100, dim.Get(0, 0).r);
            Assert.AreEqual(50, dim.Get(0, 0).g);
            Assert.AreEqual(25, dim.Get(0, 0).b);
            Assert.AreEqual(255, dim.Get(0, 0).a, "alpha không đổi");
            Assert.AreEqual(0, dim.Get(1, 0).a);
        }

        [Test]
        public void Brightness_ClampsInsteadOfWrapping()
        {
            var buf = new PixelBuffer(1, 1);
            buf.Set(0, 0, new Color32(200, 200, 200, 255));

            var bright = SpriteSheetSlicer.Brightness(buf, 2f);

            Assert.AreEqual(255, bright.Get(0, 0).r, "phải kẹp ở 255, không tràn về số nhỏ");
        }

        [Test]
        public void ObjectSize_KeepsScaleRelativeToTheWallCell()
        {
            // Vật cao đúng nửa ô tường phải ra đúng nửa canvas, không phải lấp đầy canvas.
            var size = SpriteSheetSlicer.ObjectSize(width: 100, height: 200, cell: 400f,
                                                    canvas: 64, scale: 1f);

            Assert.AreEqual(16, size.x);
            Assert.AreEqual(32, size.y);
        }

        [Test]
        public void ObjectSize_KeepsAspectAndNeverExceedsTheCanvas()
        {
            var tall = SpriteSheetSlicer.ObjectSize(205, 377, 467f, 64, 1f);
            Assert.AreEqual(28, tall.x, "nhân vật thật trên sheet: 205x377 trong ô 467");
            Assert.AreEqual(52, tall.y);

            var huge = SpriteSheetSlicer.ObjectSize(1000, 1000, 100f, 64, 1f);
            Assert.AreEqual(64, huge.x, "phải kẹp trong canvas, không tràn ra ngoài");
            Assert.AreEqual(64, huge.y);
        }

        [Test]
        public void ResampleToCanvas_LeavesTilesFullyOpaque()
        {
            var tile = new PixelBuffer(120, 130);
            for (int i = 0; i < tile.Pixels.Length; i++) tile.Pixels[i] = Art;

            var square = SpriteSheetSlicer.Resample(tile, 64, 64);

            for (int i = 0; i < square.Pixels.Length; i++)
                Assert.AreEqual(255, square.Pixels[i].a, "tile phải phủ kín ô, không chừa pixel trong suốt");
        }

        [Test]
        public void Tint_BlendsTowardsTheTintAndKeepsAlpha()
        {
            var buf = new PixelBuffer(2, 1);
            buf.Set(0, 0, new Color32(100, 100, 100, 255));
            buf.Set(1, 0, new Color32(100, 100, 100, 0));

            var tinted = SpriteSheetSlicer.Tint(buf, new Color32(200, 0, 0, 255), 0.5f);

            Assert.AreEqual(150, tinted.Get(0, 0).r);
            Assert.AreEqual(50, tinted.Get(0, 0).g);
            Assert.AreEqual(255, tinted.Get(0, 0).a);
            Assert.AreEqual(0, tinted.Get(1, 0).a, "pixel trong suốt vẫn trong suốt");
        }
```

- [ ] **Step 2: Chạy test, xác nhận nó fail**

Chạy: MCP `run_tests`, `mode: "EditMode"`, `testFilter: "SpriteSheetSlicerTests"`
Kỳ vọng: FAIL do chưa có `PlaceCentered`, `Brightness`, `Tint`.

- [ ] **Step 3: Viết ba hàm**

Thêm vào `SpriteSheetSlicer.cs`:

```csharp
        /// <summary>Đặt nội dung đã thu nhỏ vào giữa canvas vuông trong suốt.</summary>
        public static PixelBuffer PlaceCentered(PixelBuffer content, int canvas)
        {
            var dst = new PixelBuffer(canvas, canvas);
            int ox = (canvas - content.Width) / 2;
            int oy = (canvas - content.Height) / 2;

            for (int y = 0; y < content.Height; y++)
                for (int x = 0; x < content.Width; x++)
                    if (dst.Inside(ox + x, oy + y))
                        dst.Set(ox + x, oy + y, content.Get(x, y));

            return dst;
        }

        /// <summary>Nhân độ sáng, giữ nguyên alpha. Dùng để tách hai tông sàn ô caro.</summary>
        public static PixelBuffer Brightness(PixelBuffer src, float factor)
        {
            var dst = new PixelBuffer(src.Width, src.Height);
            for (int i = 0; i < src.Pixels.Length; i++)
            {
                var c = src.Pixels[i];
                dst.Pixels[i] = new Color32(Scale(c.r, factor), Scale(c.g, factor),
                                            Scale(c.b, factor), c.a);
            }
            return dst;
        }

        static byte Scale(byte v, float factor) =>
            (byte)Mathf.Clamp(Mathf.RoundToInt(v * factor), 0, 255);

        /// <summary>Pha màu về phía tint, giữ nguyên alpha. Dùng để đánh dấu hộp đã vào đích.</summary>
        public static PixelBuffer Tint(PixelBuffer src, Color32 tint, float amount)
        {
            var dst = new PixelBuffer(src.Width, src.Height);
            for (int i = 0; i < src.Pixels.Length; i++)
            {
                var c = src.Pixels[i];
                dst.Pixels[i] = new Color32(Mix(c.r, tint.r, amount), Mix(c.g, tint.g, amount),
                                            Mix(c.b, tint.b, amount), c.a);
            }
            return dst;
        }

        static byte Mix(byte from, byte to, float amount) =>
            (byte)Mathf.Clamp(Mathf.RoundToInt(Mathf.Lerp(from, to, amount)), 0, 255);

        /// <summary>
        /// Cỡ của một vật thể trên canvas, đo theo ô tường chứ không theo bounding box của
        /// chính nó. Chuẩn hoá riêng từng cái sẽ phá tương quan kích thước người vẽ đã đặt:
        /// hộp và nhân vật đều bị phóng thành cùng một cỡ dù trên sheet chúng khác nhau.
        /// </summary>
        public static Vector2Int ObjectSize(int width, int height, float cell, int canvas, float scale)
        {
            float k = canvas / cell * scale;
            return new Vector2Int(
                Mathf.Clamp(Mathf.RoundToInt(width * k), 1, canvas),
                Mathf.Clamp(Mathf.RoundToInt(height * k), 1, canvas));
        }
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Chạy: MCP `run_tests`, `mode: "EditMode"`, `testFilter: "SpriteSheetSlicerTests"`
Kỳ vọng: 21 test PASS.

- [ ] **Step 5: Commit**

```bash
git add Assets/Editor/SpriteSheetSlicer.cs Assets/Tests/EditMode/SpriteSheetSlicerTests.cs
git commit -m "Centre sprites on a square canvas and derive the colour variants"
```

---

### Task 5: Importer — đọc sheet, ghi 10 sprite, dựng Tile asset

**Files:**
- Create: `Assets/Editor/ModernArtImporter.cs`
- Create: `Assets/Art/Modern/` (thư mục, do code tạo)
- Create: `Assets/Tiles/GroundTileB.asset` (do code tạo)

**Interfaces:**
- Consumes: toàn bộ `SpriteSheetSlicer` từ Task 1–4.
- Produces: `ArtSlot` enum; `ModernArtImportSettings` class; `ModernArtImporter.Import(string sourcePath, ArtSlot[] mapping, ModernArtImportSettings settings)` trả `string` báo cáo; `ModernArtImporter.FindRegionsIn(string sourcePath, ModernArtImportSettings settings, out PixelBuffer sheet)` trả `List<RectInt>` để window dùng lại; hằng `ModernArtImporter.DefaultMapping`, `OutFolder`, `SourceFolder`, `OutSize`.

- [ ] **Step 1: Viết importer**

Tạo `Assets/Editor/ModernArtImporter.cs`:

```csharp
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Tilemaps;

namespace Sokoban.EditorTools
{
    /// <summary>Một ô trên sheet dùng làm asset gì. Skip là ô cố tình bỏ qua.</summary>
    public enum ArtSlot
    {
        Skip, Wall, Floor, Goal, Box, PlayerDown, PlayerUp, PlayerLeft, PlayerRight
    }

    [System.Serializable]
    public class ModernArtImportSettings
    {
        public int backgroundTolerance = 25;
        public float gutterRatio = 0.985f;
        public float minAreaRatio = 0.25f;
        public int despillBand = 2;
        public int despillTolerance = 8;

        // Sàn Gemini vẽ ra còn sáng hơn tường (đo được 134.5 so với 124.2) nên gần như
        // không có tương phản. Hạ sáng để tách tường khỏi đường đi, và tiện lấy luôn
        // tông thứ hai cho ô caro.
        public float floorALevel = 0.55f;
        public float floorBLevel = 0.45f;

        public Color boxOnGoalTint = new Color(1f, 0.78f, 0.25f);
        public float boxOnGoalTintAmount = 0.45f;

        /// <summary>Phóng to hay thu nhỏ vật thể so với ô tường, nếu Gemini vẽ lệch tương quan.</summary>
        public float objectScale = 1f;
    }

    /// <summary>
    /// Cắt sheet trong ArtSource/ thành bộ sprite trong Assets/Art/Modern/ rồi trỏ các
    /// Tile asset sang đó. Lớp duy nhất trong đường ống này đụng tới AssetDatabase.
    /// </summary>
    public static class ModernArtImporter
    {
        public const string OutFolder = "Assets/Art/Modern";
        public const string SourceFolder = "ArtSource";
        public const int OutSize = 64;

        /// <summary>
        /// Sheet hiện tại là lưới 3x3. Ô giữa hàng 2 là hộp-trên-đích do Gemini vẽ, cố tình
        /// bỏ vì nó là một cái thùng khác hẳn hộp thường — bản dùng trong game sinh bằng
        /// tint từ chính hộp thường.
        /// </summary>
        public static readonly ArtSlot[] DefaultMapping =
        {
            ArtSlot.Wall,       ArtSlot.Floor,        ArtSlot.Goal,
            ArtSlot.Box,        ArtSlot.Skip,         ArtSlot.PlayerDown,
            ArtSlot.PlayerUp,   ArtSlot.PlayerRight,  ArtSlot.PlayerLeft,
        };

        public static string NewestSource()
        {
            if (!Directory.Exists(SourceFolder)) return null;

            return Directory.GetFiles(SourceFolder)
                .Where(f => f.EndsWith(".png") || f.EndsWith(".jpg") || f.EndsWith(".jpeg"))
                .OrderByDescending(File.GetLastWriteTimeUtc)
                .FirstOrDefault();
        }

        public static List<RectInt> FindRegionsIn(string sourcePath, ModernArtImportSettings s,
                                                  out PixelBuffer sheet)
        {
            sheet = Load(sourcePath);
            return SpriteSheetSlicer.FindRegions(sheet, s.backgroundTolerance,
                                                 s.gutterRatio, s.minAreaRatio);
        }

        public static string Import(string sourcePath, ArtSlot[] mapping, ModernArtImportSettings s)
        {
            var regions = FindRegionsIn(sourcePath, s, out var sheet);
            if (regions.Count == 0) return "Không dò được vùng nào trên sheet.";

            var cleaned = new Dictionary<ArtSlot, PixelBuffer>();
            for (int i = 0; i < regions.Count && i < mapping.Length; i++)
            {
                if (mapping[i] == ArtSlot.Skip) continue;
                cleaned[mapping[i]] = Clean(sheet, regions[i], s);
            }

            if (!cleaned.TryGetValue(ArtSlot.Wall, out var wall))
                return "Chưa có ô nào được gán làm Wall — cần nó làm mốc quy chiếu kích thước ô.";

            // Tường là asset duy nhất chắc chắn lấp đầy một ô, nên lấy nó làm "một ô".
            float cell = Mathf.Max(wall.Width, wall.Height);

            Directory.CreateDirectory(OutFolder);

            WriteTile("wall", cleaned[ArtSlot.Wall]);

            if (cleaned.TryGetValue(ArtSlot.Floor, out var floor))
            {
                WriteTile("floor_a", SpriteSheetSlicer.Brightness(floor, s.floorALevel));
                WriteTile("floor_b", SpriteSheetSlicer.Brightness(floor, s.floorBLevel));
            }

            if (cleaned.TryGetValue(ArtSlot.Goal, out var goal))
                WriteObject("goal", goal, cell, s.objectScale);

            if (cleaned.TryGetValue(ArtSlot.Box, out var box))
            {
                WriteObject("box", box, cell, s.objectScale);
                WriteObject("box_on_goal",
                            SpriteSheetSlicer.Tint(box, s.boxOnGoalTint, s.boxOnGoalTintAmount),
                            cell, s.objectScale);
            }

            WritePlayer(cleaned, ArtSlot.PlayerDown, "player_down", cell, s.objectScale);
            WritePlayer(cleaned, ArtSlot.PlayerUp, "player_up", cell, s.objectScale);
            WritePlayer(cleaned, ArtSlot.PlayerLeft, "player_left", cell, s.objectScale);
            WritePlayer(cleaned, ArtSlot.PlayerRight, "player_right", cell, s.objectScale);

            AssetDatabase.Refresh();
            LinkTiles();
            AssetDatabase.SaveAssets();

            var missing = new[] { ArtSlot.Wall, ArtSlot.Floor, ArtSlot.Goal, ArtSlot.Box,
                                  ArtSlot.PlayerDown, ArtSlot.PlayerUp,
                                  ArtSlot.PlayerLeft, ArtSlot.PlayerRight }
                          .Where(slot => !cleaned.ContainsKey(slot)).ToList();

            string report = $"Đã nhập {regions.Count} vùng từ {Path.GetFileName(sourcePath)} " +
                            $"(ô tường {wall.Width}x{wall.Height}).";
            if (missing.Count > 0)
                report += $" CÒN THIẾU: {string.Join(", ", missing)}.";

            return report;
        }

        static PixelBuffer Load(string path)
        {
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            if (!ImageConversion.LoadImage(texture, File.ReadAllBytes(path)))
                throw new IOException($"Không đọc được ảnh: {path}");

            // Texture2D đánh y = 0 ở đáy; PixelBuffer đánh y = 0 ở đỉnh. Lật ở đây và
            // chỉ ở đây, để thứ tự đọc vùng khớp với mắt người nhìn tấm sheet.
            var buffer = new PixelBuffer(texture.width, texture.height);
            var pixels = texture.GetPixels32();
            for (int y = 0; y < texture.height; y++)
                System.Array.Copy(pixels, (texture.height - 1 - y) * texture.width,
                                  buffer.Pixels, y * texture.width, texture.width);

            Object.DestroyImmediate(texture);
            return buffer;
        }

        static PixelBuffer Clean(PixelBuffer sheet, RectInt region, ModernArtImportSettings s)
        {
            var cell = SpriteSheetSlicer.KeyOut(SpriteSheetSlicer.Crop(sheet, region),
                                                s.backgroundTolerance);
            SpriteSheetSlicer.Despill(cell, s.despillBand, s.despillTolerance);
            return cell;
        }

        /// <summary>Tile phải phủ kín ô, nên ép thẳng về 64x64 kể cả khi nguồn lệch vuông.</summary>
        static void WriteTile(string name, PixelBuffer content) =>
            Write(name, SpriteSheetSlicer.Resample(content, OutSize, OutSize));

        /// <summary>
        /// Vật thể giữ tỉ lệ khung hình gốc và giữ đúng tương quan kích thước với ô tường,
        /// thay vì mỗi cái tự chuẩn hoá theo bounding box của riêng nó.
        /// </summary>
        static void WriteObject(string name, PixelBuffer content, float cell, float scale)
        {
            var size = SpriteSheetSlicer.ObjectSize(content.Width, content.Height,
                                                    cell, OutSize, scale);

            Write(name, SpriteSheetSlicer.PlaceCentered(
                SpriteSheetSlicer.Resample(content, size.x, size.y), OutSize));
        }

        static void WritePlayer(Dictionary<ArtSlot, PixelBuffer> cleaned, ArtSlot slot,
                                string name, float cell, float scale)
        {
            if (cleaned.TryGetValue(slot, out var buffer)) WriteObject(name, buffer, cell, scale);
        }

        static void Write(string name, PixelBuffer buffer)
        {
            var texture = new Texture2D(buffer.Width, buffer.Height, TextureFormat.RGBA32, false);

            var flipped = new Color32[buffer.Pixels.Length];
            for (int y = 0; y < buffer.Height; y++)
                System.Array.Copy(buffer.Pixels, (buffer.Height - 1 - y) * buffer.Width,
                                  flipped, y * buffer.Width, buffer.Width);

            texture.SetPixels32(flipped);
            texture.Apply();

            string path = $"{OutFolder}/{name}.png";
            File.WriteAllBytes(path, texture.EncodeToPNG());
            Object.DestroyImmediate(texture);

            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            ApplyImportSettings(path);
        }

        static void ApplyImportSettings(string path)
        {
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            if (importer == null) return;

            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = OutSize;
            importer.filterMode = FilterMode.Point;
            importer.alphaIsTransparency = true;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.SaveAndReimport();
        }

        static void LinkTiles()
        {
            LinkTile("Assets/Tiles/WallTile.asset", "wall");
            LinkTile("Assets/Tiles/GroundTile.asset", "floor_a");
            LinkTile("Assets/Tiles/GroundTileB.asset", "floor_b");
            LinkTile("Assets/Tiles/GoalTile.asset", "goal");
        }

        static void LinkTile(string tilePath, string spriteName)
        {
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>($"{OutFolder}/{spriteName}.png");
            if (sprite == null) return;

            var tile = AssetDatabase.LoadAssetAtPath<Tile>(tilePath);
            if (tile == null)
            {
                tile = ScriptableObject.CreateInstance<Tile>();
                AssetDatabase.CreateAsset(tile, tilePath);
            }

            tile.sprite = sprite;
            EditorUtility.SetDirty(tile);
        }

        [MenuItem("Sokoban/Import Modern Art")]
        public static void ImportNewest()
        {
            string source = NewestSource();
            if (source == null)
            {
                Debug.LogError($"ModernArtImporter: không thấy ảnh nào trong {SourceFolder}/");
                return;
            }

            Debug.Log("ModernArtImporter: " +
                      Import(source, DefaultMapping, new ModernArtImportSettings()));
        }
    }
}
```

- [ ] **Step 2: Biên dịch sạch**

Gọi MCP `refresh_unity`, rồi `read_console`.
Kỳ vọng: 0 lỗi, 0 warning mới.

- [ ] **Step 3: Chạy lại toàn bộ test cũ**

Chạy: MCP `run_tests`, `mode: "EditMode"`
Kỳ vọng: 21 test của `SpriteSheetSlicerTests` vẫn PASS, và mọi test cũ của project vẫn PASS — thêm reference `Sokoban.Editor` vào assembly test không được làm hỏng gì.

- [ ] **Step 4: Chạy importer trên ảnh thật**

Gọi MCP `execute_menu_item` với `Sokoban/Import Modern Art`, rồi `read_console`.
Kỳ vọng: log dạng `Đã nhập 9 vùng từ Gemini_Generated_Image_....png (ô tường 439x467).`

Nếu sheet chưa có hướng nhìn từ sau lưng thì log sẽ kèm `CÒN THIẾU: PlayerUp` — đó là trạng thái đúng cho tới khi người dùng cấp sheet đã sửa. Không được sửa mapping để lấy tạm ô lặp.

- [ ] **Step 5: Kiểm tra mắt 10 file vừa ghi**

Đọc từng ảnh trong `Assets/Art/Modern/` và xác nhận:

| Kiểm | Đạt khi |
|---|---|
| Không còn viền hồng | Không thấy pixel hồng/tím ở mép bất kỳ sprite nào. Còn thì tăng `despillBand` lên 3 hoặc `backgroundTolerance` lên 35 |
| `wall` và `floor_a` phủ kín | Không có góc trong suốt |
| `floor_a` tối hơn `wall` rõ rệt | Nhìn cạnh nhau tách bạch được ngay |
| `floor_b` tối hơn `floor_a` | Đủ thấy nhưng không thành hai màu khác nhau |
| `goal` trong suốt ngoài vòng đích | Nền quanh vòng phải trong suốt, không phải một ô đặc |
| `box_on_goal` khác `box` | Cùng một cái thùng, chỉ ám vàng hơn |
| **`player_left` quay mặt sang trái, `player_right` sang phải** | Nhìn hướng mũi. Project từng có commit `e281d0d` sửa đúng lỗi tráo hai cái này — kiểm kỹ, đừng tin ánh xạ mặc định |
| Nhân vật không bị béo ngang | Vẫn giữ dáng cao gầy như trên sheet |
| Bóng tím dưới chân | Nếu còn một vệt tím mờ dưới chân nhân vật thì nâng `backgroundTolerance` |

- [ ] **Step 6: Commit**

```bash
git add Assets/Editor/ModernArtImporter.cs Assets/Editor/ModernArtImporter.cs.meta \
        Assets/Art/Modern Assets/Tiles/GroundTileB.asset Assets/Tiles/GroundTileB.asset.meta \
        Assets/Tiles/WallTile.asset Assets/Tiles/GroundTile.asset Assets/Tiles/GoalTile.asset
git commit -m "Import the Gemini sheet into a modern art set and point the tiles at it"
```

---

### Task 6: Editor window để xem trước và chỉnh hằng số

**Files:**
- Create: `Assets/Editor/ModernArtImporterWindow.cs`

**Interfaces:**
- Consumes: `ModernArtImporter.NewestSource`, `FindRegionsIn`, `Import`, `DefaultMapping`, `OutSize`; `ModernArtImportSettings`; `ArtSlot`; `PixelBuffer`.
- Produces: menu `Sokoban/Modern Art Importer`.

- [ ] **Step 1: Viết window**

Tạo `Assets/Editor/ModernArtImporterWindow.cs`:

```csharp
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Sokoban.EditorTools
{
    /// <summary>
    /// Xem trước các vùng dò được trên sheet rồi mới ghi đè asset. Cần nó vì Gemini xếp
    /// lưới khác nhau giữa các lần sinh, và vì mấy hằng số màu phải chỉnh bằng mắt.
    /// </summary>
    public class ModernArtImporterWindow : EditorWindow
    {
        const string MappingKey = "Sokoban.ModernArt.Mapping";

        string _sourcePath;
        Texture2D _preview;
        List<RectInt> _regions = new List<RectInt>();
        ArtSlot[] _mapping = (ArtSlot[])ModernArtImporter.DefaultMapping.Clone();
        ModernArtImportSettings _settings = new ModernArtImportSettings();
        Vector2 _scroll;
        string _report;

        [MenuItem("Sokoban/Modern Art Importer")]
        public static void Open() => GetWindow<ModernArtImporterWindow>("Modern Art");

        void OnEnable()
        {
            _sourcePath = ModernArtImporter.NewestSource();
            LoadMapping();
            if (_sourcePath != null) Scan();
        }

        void OnGUI()
        {
            _scroll = EditorGUILayout.BeginScrollView(_scroll);

            DrawSourceRow();

            if (_sourcePath == null)
            {
                EditorGUILayout.HelpBox(
                    $"Không thấy ảnh nào trong {ModernArtImporter.SourceFolder}/. " +
                    "Tải sheet từ Gemini về đó rồi bấm Dò lại.", MessageType.Info);
                EditorGUILayout.EndScrollView();
                return;
            }

            DrawSettings();
            DrawPreview();
            DrawMapping();
            DrawImportRow();

            EditorGUILayout.EndScrollView();
        }

        void DrawSourceRow()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            GUILayout.Label(_sourcePath == null ? "(chưa có ảnh)" : Path.GetFileName(_sourcePath));
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Dò lại", EditorStyles.toolbarButton))
            {
                _sourcePath = ModernArtImporter.NewestSource();
                if (_sourcePath != null) Scan();
            }
            EditorGUILayout.EndHorizontal();
        }

        void DrawSettings()
        {
            EditorGUILayout.LabelField("Tách nền", EditorStyles.boldLabel);
            _settings.backgroundTolerance =
                EditorGUILayout.IntSlider("Ngưỡng nền", _settings.backgroundTolerance, 5, 80);
            _settings.despillBand =
                EditorGUILayout.IntSlider("Dải khử ám", _settings.despillBand, 0, 5);
            _settings.minAreaRatio =
                EditorGUILayout.Slider("Ngưỡng loại đốm", _settings.minAreaRatio, 0.02f, 0.9f);

            EditorGUILayout.LabelField("Màu suy ra", EditorStyles.boldLabel);
            _settings.floorALevel = EditorGUILayout.Slider("Sàn tông A", _settings.floorALevel, 0.2f, 1f);
            _settings.floorBLevel = EditorGUILayout.Slider("Sàn tông B", _settings.floorBLevel, 0.2f, 1f);
            _settings.boxOnGoalTint = EditorGUILayout.ColorField("Tint hộp đích", _settings.boxOnGoalTint);
            _settings.boxOnGoalTintAmount =
                EditorGUILayout.Slider("Độ tint", _settings.boxOnGoalTintAmount, 0f, 1f);
            _settings.objectScale = EditorGUILayout.Slider("Cỡ vật thể", _settings.objectScale, 0.5f, 1.5f);

            EditorGUILayout.HelpBox(
                "Đổi ngưỡng nền hoặc ngưỡng loại đốm thì bấm Dò lại để cập nhật khung xem trước. " +
                "Không dò tự động vì mỗi lần dò phải quét hết 4.3 triệu pixel, kéo thanh trượt sẽ đứng hình.",
                MessageType.None);
        }

        void DrawPreview()
        {
            if (_preview == null) return;

            float width = Mathf.Min(position.width - 20f, 420f);
            float scale = width / _preview.width;
            var rect = GUILayoutUtility.GetRect(width, _preview.height * scale);

            GUI.DrawTexture(rect, _preview, ScaleMode.ScaleToFit);

            for (int i = 0; i < _regions.Count; i++)
            {
                var r = _regions[i];
                var box = new Rect(rect.x + r.x * scale, rect.y + r.y * scale,
                                   r.width * scale, r.height * scale);
                Handles.DrawSolidRectangleWithOutline(box, Color.clear, Color.cyan);
                GUI.Label(new Rect(box.x + 2, box.y + 2, 120, 16), $"{i}: {SlotAt(i)}");
            }
        }

        void DrawMapping()
        {
            EditorGUILayout.LabelField($"Ánh xạ {_regions.Count} vùng", EditorStyles.boldLabel);
            EnsureMappingLength();

            for (int i = 0; i < _regions.Count; i++)
            {
                var r = _regions[i];
                _mapping[i] = (ArtSlot)EditorGUILayout.EnumPopup(
                    $"Vùng {i} ({r.width}x{r.height})", _mapping[i]);
            }
        }

        void DrawImportRow()
        {
            EditorGUILayout.Space();
            if (GUILayout.Button("Import — ghi đè Assets/Art/Modern", GUILayout.Height(28)))
            {
                SaveMapping();
                _report = ModernArtImporter.Import(_sourcePath, _mapping, _settings);
                Debug.Log("ModernArtImporter: " + _report);
            }

            if (!string.IsNullOrEmpty(_report))
                EditorGUILayout.HelpBox(_report,
                    _report.Contains("THIẾU") ? MessageType.Warning : MessageType.Info);
        }

        ArtSlot SlotAt(int i) => i < _mapping.Length ? _mapping[i] : ArtSlot.Skip;

        void Scan()
        {
            _regions = ModernArtImporter.FindRegionsIn(_sourcePath, _settings, out _);
            EnsureMappingLength();
            BuildPreview();
        }

        void EnsureMappingLength()
        {
            if (_mapping.Length >= _regions.Count) return;

            var grown = new ArtSlot[_regions.Count];
            System.Array.Copy(_mapping, grown, _mapping.Length);
            _mapping = grown;
        }

        void BuildPreview()
        {
            if (_preview != null) DestroyImmediate(_preview);

            _preview = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            ImageConversion.LoadImage(_preview, File.ReadAllBytes(_sourcePath));
            _preview.filterMode = FilterMode.Bilinear;
        }

        void LoadMapping()
        {
            string saved = EditorPrefs.GetString(MappingKey, "");
            if (string.IsNullOrEmpty(saved)) return;

            var parts = saved.Split(',');
            var loaded = new ArtSlot[parts.Length];
            for (int i = 0; i < parts.Length; i++)
                loaded[i] = System.Enum.TryParse(parts[i], out ArtSlot slot) ? slot : ArtSlot.Skip;

            _mapping = loaded;
        }

        void SaveMapping() =>
            EditorPrefs.SetString(MappingKey, string.Join(",", _mapping));

        void OnDisable()
        {
            if (_preview != null) DestroyImmediate(_preview);
        }
    }
}
```

- [ ] **Step 2: Biên dịch sạch**

Gọi MCP `refresh_unity`, rồi `read_console`.
Kỳ vọng: 0 lỗi.

- [ ] **Step 3: Mở window và kiểm mắt**

Gọi MCP `execute_menu_item` với `Sokoban/Modern Art Importer`, chụp lại window.
Kỳ vọng: thấy tấm sheet với 9 khung cyan bao đúng từng ô, mỗi khung có nhãn `0: Wall`, `1: Floor`, … đúng thứ tự đọc trái→phải trên→dưới. Khung lệch hoặc thiếu thì chỉnh `Ngưỡng nền` và `Ngưỡng loại đốm`.

- [ ] **Step 4: Commit**

```bash
git add Assets/Editor/ModernArtImporterWindow.cs Assets/Editor/ModernArtImporterWindow.cs.meta
git commit -m "Add a window to preview sheet regions before overwriting the art"
```

---

### Task 7: Sàn ô caro và nối dây scene

**Files:**
- Modify: `Assets/Scripts/View/BoardRenderer.cs:16-19` (khai báo tile) và `:69` (chọn tile nền)
- Modify: `Assets/Scenes/Main.unity` (gán tile và sprite vào `BoardRenderer`)

**Interfaces:**
- Consumes: `Assets/Tiles/GroundTileB.asset` và 10 sprite trong `Assets/Art/Modern/` do Task 5 sinh ra.
- Produces: bàn cờ có sàn hai tông xen kẽ.

- [ ] **Step 1: Thêm trường tile thứ hai**

Trong `Assets/Scripts/View/BoardRenderer.cs`, sửa khối `[Header("Tiles")]`:

```csharp
        [Header("Tiles")]
        [SerializeField] TileBase groundTile;
        [SerializeField] TileBase groundTileB;
        [SerializeField] TileBase goalTile;
        [SerializeField] TileBase wallTile;
```

- [ ] **Step 2: Chọn tile nền xen kẽ**

Trong cùng file, thay dòng đặt tile nền trong `Render`:

```csharp
                    // Sàn hai tông xen kẽ như bàn cờ, để bàn chơi rộng đỡ phẳng lì.
                    bool even = (x + y) % 2 == 0;
                    groundTilemap.SetTile(pos, even
                        ? Resolve(groundTile, "ground")
                        : Resolve(groundTileB, "ground B"));
```

Giữ nguyên dòng đặt goal tile ngay dưới nó.

- [ ] **Step 3: Biên dịch sạch**

Gọi MCP `refresh_unity`, rồi `read_console`.
Kỳ vọng: 0 lỗi. `BoardRenderer` chưa được gán `groundTileB` nên lúc chạy sẽ log lỗi và vẽ ô hồng — đúng như thiết kế, sẽ gán ở bước sau.

- [ ] **Step 4: Gán tile và sprite trong scene**

Mở `Assets/Scenes/Main.unity`, chọn GameObject có `BoardRenderer`, gán:

| Trường | Asset |
|---|---|
| Ground Tile | `Assets/Tiles/GroundTile.asset` |
| Ground Tile B | `Assets/Tiles/GroundTileB.asset` |
| Goal Tile | `Assets/Tiles/GoalTile.asset` |
| Wall Tile | `Assets/Tiles/WallTile.asset` |
| Box Sprite | `Assets/Art/Modern/box.png` |
| Box On Goal Sprite | `Assets/Art/Modern/box_on_goal.png` |
| Player Down Sprite | `Assets/Art/Modern/player_down.png` |
| Player Up Sprite | `Assets/Art/Modern/player_up.png` |
| Player Left Sprite | `Assets/Art/Modern/player_left.png` |
| Player Right Sprite | `Assets/Art/Modern/player_right.png` |

Đây là lần gán tay duy nhất. Importer luôn ghi ra đúng những đường dẫn này nên `.meta` và GUID giữ nguyên, các lần import sau tự cập nhật.

Cũng cần gán sprite mặc định cho `Assets/Prefabs/Player.prefab` và `Assets/Prefabs/Box.prefab` sang art mới, nếu không thì một khung hình đầu tiên trước khi `SpawnActors` chạy vẫn hiện art cũ.

- [ ] **Step 5: Chạy thử và soi bàn cờ**

Vào Play mode, chọn màn 1. Chụp Game view.

Kỳ vọng:
- Nền có ô sáng ô tối xen kẽ như bàn cờ, không có ô hồng chói nào
- Tường tách bạch rõ khỏi nền
- Đích thấy được vòng đỏ nằm trên sàn, không phải một ô đặc che mất sàn
- Nhân vật đứng giữa ô, không bị cắt hay tràn sang ô bên

Bấm bốn phím mũi tên và xác nhận nhân vật quay đúng hướng — **đặc biệt là trái và phải**, project từng có bug tráo hai hướng này.

- [ ] **Step 6: Chạy toàn bộ test**

Chạy: MCP `run_tests`, `mode: "EditMode"`
Kỳ vọng: toàn bộ test của project PASS. `BoardRenderer` không có test EditMode nên đây là kiểm tra hồi quy cho phần còn lại.

- [ ] **Step 7: Commit**

```bash
git add Assets/Scripts/View/BoardRenderer.cs Assets/Scenes/Main.unity \
        Assets/Prefabs/Player.prefab Assets/Prefabs/Box.prefab
git commit -m "Alternate two floor tones and switch the board over to the modern art"
```

---

## Việc còn treo ngoài plan

`player_up` (nhân vật nhìn từ sau lưng) chưa có trên sheet — ô hàng 3 cột 1 hiện là bản lặp của hướng down. Importer sẽ báo `CÒN THIẾU: PlayerUp` cho tới khi người dùng cấp sheet đã sửa. Khi có sheet mới, chỉ cần chạy lại `Sokoban/Import Modern Art` — không phải sửa code hay gán lại gì trong scene.
