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
        // band=2 để lại một vệt tím mờ dưới chân nhân vật (đo được trên ảnh thật, ví dụ
        // player_up còn 7 pixel rgb quanh (160,85,155) sát mép trong suốt) — band=3 xoá sạch.
        public int despillBand = 3;
        public int despillTolerance = 8;

        // Nhân vật còn một mảng bóng tím đặc (rgba quanh (172,87,161,255)) dưới chân, nằm sâu
        // trong ruột sprite — đo trực tiếp trên sheet gốc thì mảng này rộng hàng chục pixel,
        // ngoài tầm mọi band hợp lý. Bật tràn toàn sprite: bộ lọc màu của Despill tự loại đá
        // xám, mũ xám, sơ mi trắng (r=g=b) và gỗ/da/đỏ/tông vàng box_on_goal (lam thấp), nên
        // chỉ có mảng ám hồng/tím mới bị hạ về xám trung tính.
        public bool despillWholeSprite = true;

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
            SpriteSheetSlicer.Despill(cell, s.despillBand, s.despillTolerance, s.despillWholeSprite);
            return cell;
        }

        /// <summary>
        /// Tile phải phủ kín ô, nên ép thẳng về 64x64 kể cả khi nguồn lệch vuông, rồi ép alpha
        /// về 255 — Resample lấy trung bình alpha thẳng nên rìa ô có thể hụt xuống dưới 255 dù
        /// màu đã đúng, để lộ nền camera qua khe ô trên bàn cờ.
        /// </summary>
        static void WriteTile(string name, PixelBuffer content) =>
            Write(name, SpriteSheetSlicer.Opaque(SpriteSheetSlicer.Resample(content, OutSize, OutSize)));

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
