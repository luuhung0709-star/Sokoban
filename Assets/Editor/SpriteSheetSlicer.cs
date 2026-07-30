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
