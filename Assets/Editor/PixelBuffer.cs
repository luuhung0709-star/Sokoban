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
