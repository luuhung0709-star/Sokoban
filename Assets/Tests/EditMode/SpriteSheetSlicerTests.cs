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
    }
}
