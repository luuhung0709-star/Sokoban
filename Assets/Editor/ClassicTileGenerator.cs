using System.IO;
using UnityEditor;
using UnityEngine;

namespace Sokoban.EditorTools
{
    /// <summary>
    /// Sinh bộ art "cổ điển" (tường xám vát cạnh, nền xám phẳng, đích vòng tròn, hộp vàng,
    /// nhân vật khối tối có mũi chỉ hướng) bằng code, không phụ thuộc asset tải về.
    /// Muốn đổi tông màu hay độ vát thì sửa hằng số ở đây rồi chạy lại menu.
    /// </summary>
    public static class ClassicTileGenerator
    {
        const string OutFolder = "Assets/Art/Classic";
        const int Size = 64;            // 1 ô = 64 px, khớp Pixels Per Unit 64
        const int Bevel = 8;            // độ dày mép vát của tường và hộp
        const int Outline = 1;          // khe tối quanh mỗi ô, để các ô không dính vào nhau

        static readonly Color32 OutlineColor = new Color32(26, 26, 30, 255);

        static readonly Color32 WallBase = new Color32(182, 187, 194, 255);
        static readonly Color32 WallLight = new Color32(228, 232, 236, 255);
        static readonly Color32 WallDark = new Color32(132, 138, 148, 255);

        static readonly Color32 FloorColor = new Color32(74, 78, 86, 255);
        static readonly Color32 GoalFloor = new Color32(66, 70, 78, 255);
        static readonly Color32 GoalRing = new Color32(196, 201, 209, 255);

        static readonly Color32 BoxBase = new Color32(240, 180, 41, 255);
        static readonly Color32 BoxLight = new Color32(252, 214, 110, 255);
        static readonly Color32 BoxDark = new Color32(196, 138, 22, 255);
        static readonly Color32 BoxMark = new Color32(150, 100, 12, 255);

        static readonly Color32 PlayerBody = new Color32(24, 26, 32, 255);
        static readonly Color32 PlayerEdge = new Color32(244, 247, 250, 255);

        // Khối tối trên nền xám đậm rất dễ mất dấu ở các màn rộng như 155,
        // nên nhân vật to gần hết ô và viền sáng dày hẳn ra.
        const float PlayerRadiusX = 18f;
        const float PlayerRadiusY = 22f;
        const float PlayerEdgeFrom = 0.60f;   // phần bán kính ngoài mốc này là viền sáng

        [MenuItem("Sokoban/Generate Classic Art")]
        public static void Generate()
        {
            Directory.CreateDirectory(OutFolder);

            Write("wall", Beveled(WallBase, WallLight, WallDark, roundCorners: false));
            Write("floor", Flat(FloorColor));

            var goal = Flat(GoalFloor);
            Ring(goal, radius: 15f, thickness: 4f, color: GoalRing);
            Write("goal", goal);

            var box = Beveled(BoxBase, BoxLight, BoxDark, roundCorners: true);
            Ring(box, radius: 14f, thickness: 5f, color: BoxMark);
            Write("box", box);

            var boxOnGoal = Beveled(BoxBase, BoxLight, BoxDark, roundCorners: true);
            Cross(boxOnGoal, thickness: 6f, color: BoxMark);
            Write("box_on_goal", boxOnGoal);

            // Mũi nhọn nằm về phía nhân vật đang đi: tên file mô tả đúng hướng mũi trên ảnh.
            Write("player_up", Player(0, 1));
            Write("player_down", Player(0, -1));
            Write("player_left", Player(-1, 0));
            Write("player_right", Player(1, 0));

            AssetDatabase.Refresh();
            Debug.Log($"ClassicTileGenerator: đã sinh 9 ảnh vào {OutFolder}");
        }

        static Texture2D Flat(Color32 color)
        {
            var tex = new Texture2D(Size, Size, TextureFormat.RGBA32, false);
            for (int y = 0; y < Size; y++)
                for (int x = 0; x < Size; x++)
                    tex.SetPixel(x, y, color);
            return tex;
        }

        /// <summary>Ô vuông có mép vát: mép trên và trái ăn sáng, mép dưới và phải chìm tối.</summary>
        static Texture2D Beveled(Color32 baseColor, Color32 light, Color32 dark, bool roundCorners)
        {
            var tex = new Texture2D(Size, Size, TextureFormat.RGBA32, false);
            const int radius = 6;

            for (int y = 0; y < Size; y++)
                for (int x = 0; x < Size; x++)
                {
                    if (roundCorners && OutsideRoundedCorner(x, y, radius))
                    {
                        tex.SetPixel(x, y, new Color(0f, 0f, 0f, 0f));
                        continue;
                    }

                    int toTop = Size - 1 - y, toBottom = y, toLeft = x, toRight = Size - 1 - x;
                    int nearest = Mathf.Min(Mathf.Min(toTop, toBottom), Mathf.Min(toLeft, toRight));

                    Color32 c;
                    if (nearest < Outline) c = OutlineColor;
                    else if (nearest < Bevel) c = (toTop == nearest || toLeft == nearest) ? light : dark;
                    else c = baseColor;

                    tex.SetPixel(x, y, c);
                }

            return tex;
        }

        static bool OutsideRoundedCorner(int x, int y, int radius)
        {
            bool inCornerBox = (x < radius || x > Size - 1 - radius) &&
                               (y < radius || y > Size - 1 - radius);
            if (!inCornerBox) return false;

            float cx = x < Size / 2 ? radius : Size - 1 - radius;
            float cy = y < Size / 2 ? radius : Size - 1 - radius;
            return new Vector2(x - cx, y - cy).magnitude > radius + 0.5f;
        }

        static void Ring(Texture2D tex, float radius, float thickness, Color32 color)
        {
            float c = (Size - 1) / 2f;
            for (int y = 0; y < Size; y++)
                for (int x = 0; x < Size; x++)
                    if (Mathf.Abs(new Vector2(x - c, y - c).magnitude - radius) <= thickness / 2f)
                        tex.SetPixel(x, y, color);
        }

        static void Cross(Texture2D tex, float thickness, Color32 color)
        {
            float c = (Size - 1) / 2f;
            for (int y = 0; y < Size; y++)
                for (int x = 0; x < Size; x++)
                {
                    float dx = x - c, dy = y - c;
                    if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) > 17f) continue;
                    if (Mathf.Abs(dx - dy) <= thickness / 2f || Mathf.Abs(dx + dy) <= thickness / 2f)
                        tex.SetPixel(x, y, color);
                }
        }

        /// <summary>Khối bầu dục tối viền sáng, kèm mũi nhọn nhô ra theo (dirX, dirY) trên ảnh.</summary>
        static Texture2D Player(int dirX, int dirY)
        {
            var tex = new Texture2D(Size, Size, TextureFormat.RGBA32, false);
            for (int y = 0; y < Size; y++)
                for (int x = 0; x < Size; x++)
                    tex.SetPixel(x, y, new Color(0f, 0f, 0f, 0f));

            float c = (Size - 1) / 2f;

            for (int y = 0; y < Size; y++)
                for (int x = 0; x < Size; x++)
                {
                    float nx = (x - c) / PlayerRadiusX, ny = (y - c) / PlayerRadiusY;
                    float d = nx * nx + ny * ny;
                    if (d <= 1f) tex.SetPixel(x, y, d > PlayerEdgeFrom ? PlayerEdge : PlayerBody);
                }

            // Tam giác thu dần, hai vòng đầu để màu thân cho liền khối rồi mới sáng ra ngoài.
            int reachX = (int)PlayerRadiusX - 4, reachY = (int)PlayerRadiusY - 4;
            for (int i = 0; i < 9; i++)
            {
                int half = 7 - i;
                for (int j = -half; j <= half; j++)
                {
                    int px = (int)c + dirX * (reachX + i) + (dirX == 0 ? j : 0);
                    int py = (int)c + dirY * (reachY + i) + (dirY == 0 ? j : 0);
                    if (px < 0 || px >= Size || py < 0 || py >= Size) continue;
                    tex.SetPixel(px, py, i < 2 ? PlayerBody : PlayerEdge);
                }
            }

            return tex;
        }

        static void Write(string name, Texture2D tex)
        {
            tex.Apply();
            string path = $"{OutFolder}/{name}.png";
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);

            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            ApplyImportSettings(path);
        }

        /// <summary>Khớp cài đặt của art Kenney: 1 ô = 1 unit, ảnh sắc nét, không nén.</summary>
        static void ApplyImportSettings(string path)
        {
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            if (importer == null) return;

            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = Size;
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.SaveAndReimport();
        }
    }
}
