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
