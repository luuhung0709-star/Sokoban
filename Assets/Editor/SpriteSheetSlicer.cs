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
    }
}
