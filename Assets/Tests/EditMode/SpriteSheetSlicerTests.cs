using NUnit.Framework;
using Sokoban.EditorTools;
using UnityEngine;

namespace Sokoban.Tests
{
    public class SpriteSheetSlicerTests
    {
        const int Tol = 25;

        static Color32 C(int r, int g, int b) => new Color32((byte)r, (byte)g, (byte)b, 255);

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
        public void Despill_WholeSprite_ReachesPixelsFarFromTheEdge()
        {
            // Cùng thiết lập với Despill_DoesNotTouchPixelsAwayFromTheEdge, nhưng bật
            // wholeSprite: pixel giữa ảnh giờ phải bị chạm dù cách mép trong suốt xa hơn band.
            var buf = new PixelBuffer(12, 12);
            Fill(buf, new RectInt(0, 0, 12, 12), new Color32(200, 80, 200, 255));
            Fill(buf, new RectInt(0, 0, 1, 12), new Color32(0, 0, 0, 0));

            SpriteSheetSlicer.Despill(buf, band: 2, tolerance: 8, wholeSprite: true);

            Assert.LessOrEqual(buf.Get(6, 6).r, 88,
                "wholeSprite bỏ giới hạn band, chạm cả pixel nằm sâu giữa ảnh");
        }

        [Test]
        public void Despill_WholeSprite_StillLeavesRedAndWhiteAndGreyAlone()
        {
            var buf = new PixelBuffer(12, 12);
            Fill(buf, new RectInt(0, 0, 4, 12), new Color32(200, 40, 40, 255));   // vòng đích đỏ
            Fill(buf, new RectInt(4, 0, 4, 12), new Color32(250, 250, 250, 255)); // sơ mi trắng
            Fill(buf, new RectInt(8, 0, 4, 12), new Color32(140, 140, 140, 255)); // đá/mũ xám
            Fill(buf, new RectInt(0, 0, 1, 12), new Color32(0, 0, 0, 0));         // một mép trong suốt

            SpriteSheetSlicer.Despill(buf, band: 2, tolerance: 8, wholeSprite: true);

            Assert.AreEqual(200, buf.Get(2, 6).r, "đỏ có lam thấp, không bị đụng dù quét cả sprite");
            Assert.AreEqual(250, buf.Get(6, 6).r, "trắng có r=g=b, không bị đụng");
            Assert.AreEqual(140, buf.Get(10, 6).r, "xám có r=g=b, không bị đụng");
        }

        [Test]
        public void Despill_DefaultsToBandedBehaviour_WhenWholeSpriteOmitted()
        {
            // Gọi đúng 3 tham số như trước khi có wholeSprite — các lời gọi cũ không được đổi hành vi.
            var buf = new PixelBuffer(12, 12);
            Fill(buf, new RectInt(0, 0, 12, 12), new Color32(200, 80, 200, 255));
            Fill(buf, new RectInt(0, 0, 1, 12), new Color32(0, 0, 0, 0));

            SpriteSheetSlicer.Despill(buf, band: 2, tolerance: 8);

            Assert.AreEqual(200, buf.Get(6, 6).r, "không truyền wholeSprite thì mặc định false, hành vi banded cũ");
        }

        [Test]
        public void Opaque_ForcesAlphaTo255_KeepsColour()
        {
            var buf = new PixelBuffer(2, 1);
            buf.Set(0, 0, new Color32(200, 100, 50, 130)); // mép tile lỡ nửa đục nửa trong sau Resample
            buf.Set(1, 0, new Color32(10, 20, 30, 0));     // thậm chí trong suốt hoàn toàn

            var opaque = SpriteSheetSlicer.Opaque(buf);

            Assert.AreEqual(255, opaque.Get(0, 0).a);
            Assert.AreEqual(255, opaque.Get(1, 0).a, "kể cả pixel vốn trong suốt cũng bị ép đục");
            Assert.AreEqual(200, opaque.Get(0, 0).r, "màu giữ nguyên");
            Assert.AreEqual(20, opaque.Get(1, 0).g, "màu giữ nguyên");
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
    }
}
