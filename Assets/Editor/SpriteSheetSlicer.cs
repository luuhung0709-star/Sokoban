using System.Collections.Generic;
using System.Linq;
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
    }
}
