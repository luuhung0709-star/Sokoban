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

        /// <summary>Trả về khi FindRegions không thấy vùng nào — lỗi cứng, không nhập được gì.</summary>
        public const string NoRegionsFoundError = "Không dò được vùng nào trên sheet.";

        /// <summary>
        /// Trả về khi không có vùng nào gán làm Wall — lỗi cứng, vì Wall là mốc quy chiếu kích
        /// thước ô cho mọi asset khác.
        /// </summary>
        public const string NoWallMappedError =
            "Chưa có ô nào được gán làm Wall — cần nó làm mốc quy chiếu kích thước ô.";

        /// <summary>Hai chuỗi lỗi cứng ở trên không phải log info như báo cáo thành công bình thường.</summary>
        public static bool IsHardFailure(string report) =>
            report == NoRegionsFoundError || report == NoWallMappedError;

        public static string NewestSource()
        {
            if (!Directory.Exists(SourceFolder)) return null;

            return Directory.GetFiles(SourceFolder)
                .Where(f => f.EndsWith(".png", System.StringComparison.OrdinalIgnoreCase) ||
                           f.EndsWith(".jpg", System.StringComparison.OrdinalIgnoreCase) ||
                           f.EndsWith(".jpeg", System.StringComparison.OrdinalIgnoreCase))
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

        /// <summary>Dựng PixelBuffer từ một Texture2D đã giải mã sẵn — dùng khi nơi gọi (ví dụ cửa
        /// sổ xem trước) cần giữ lại chính texture đó để vẽ, tránh giải mã file ảnh hai lần.</summary>
        public static PixelBuffer ToPixelBuffer(Texture2D texture)
        {
            // Texture2D đánh y = 0 ở đáy; PixelBuffer đánh y = 0 ở đỉnh. Lật ở đây, khớp với Load.
            var buffer = new PixelBuffer(texture.width, texture.height);
            var pixels = texture.GetPixels32();
            for (int y = 0; y < texture.height; y++)
                System.Array.Copy(pixels, (texture.height - 1 - y) * texture.width,
                                  buffer.Pixels, y * texture.width, texture.width);
            return buffer;
        }

        public static string Import(string sourcePath, ArtSlot[] mapping, ModernArtImportSettings s)
        {
            var regions = FindRegionsIn(sourcePath, s, out var sheet);
            return Import(regions, sheet, sourcePath, mapping, s);
        }

        static string Import(List<RectInt> regions, PixelBuffer sheet, string sourcePath,
                             ArtSlot[] mapping, ModernArtImportSettings s)
        {
            if (regions.Count == 0) return NoRegionsFoundError;

            var cleaned = new Dictionary<ArtSlot, PixelBuffer>();
            for (int i = 0; i < regions.Count && i < mapping.Length; i++)
            {
                if (mapping[i] == ArtSlot.Skip) continue;
                if (cleaned.ContainsKey(mapping[i]))
                    Debug.LogWarning($"ModernArtImporter: nhiều vùng cùng gán vào {mapping[i]} — " +
                                     $"vùng {i} ghi đè vùng gán trước đó, vùng cũ bị mất.");
                cleaned[mapping[i]] = Clean(sheet, regions[i], s);
            }

            if (!cleaned.TryGetValue(ArtSlot.Wall, out var wall))
                return NoWallMappedError;

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

            var buffer = ToPixelBuffer(texture);
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
        /// màu đã đúng, để lộ nền camera qua khe ô trên bàn cờ. Ép đục không phân biệt được rìa
        /// hụt alpha vô hại với một mảng trong suốt thật sự (ví dụ góc tường bo tròn trên sheet
        /// mới) — cái sau sẽ hoá đen đục âm thầm, nên cảnh báo trước khi ép.
        /// </summary>
        static void WriteTile(string name, PixelBuffer content)
        {
            var resampled = SpriteSheetSlicer.Resample(content, OutSize, OutSize);

            int transparent = SpriteSheetSlicer.CountFullyTransparentPixels(resampled);
            if (transparent > 0)
                Debug.LogWarning($"ModernArtImporter: {name}.png có {transparent} pixel trong suốt " +
                                 "hoàn toàn bị ép thành đen đục — nếu đây không phải rìa hụt alpha do " +
                                 "Resample mà là phần trong suốt thật trên sheet, tile sẽ có mảng đen.");

            Write(name, SpriteSheetSlicer.Opaque(resampled));
        }

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
            if (importer == null)
            {
                Debug.LogError($"ModernArtImporter: không lấy được TextureImporter cho {path} — " +
                               "sprite giữ nguyên PPU 100 và filter mặc định của Unity, sẽ nhìn sai.");
                return;
            }

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
            if (sprite == null)
            {
                Debug.LogError($"ModernArtImporter: không tìm thấy {OutFolder}/{spriteName}.png — " +
                               $"{tilePath} vẫn trỏ vào art cũ.");
                return;
            }

            var tile = AssetDatabase.LoadAssetAtPath<Tile>(tilePath);
            if (tile == null)
            {
                tile = ScriptableObject.CreateInstance<Tile>();
                AssetDatabase.CreateAsset(tile, tilePath);
            }

            tile.sprite = sprite;
            EditorUtility.SetDirty(tile);
        }

        /// <summary>
        /// Đường một-cú-bấm cho trường hợp thường: sheet mới xếp đúng lưới 3x3 như
        /// DefaultMapping giả định. Không đoán khi số vùng dò được lệch với DefaultMapping —
        /// một gutter hụt trên sheet mới có thể làm hai ô dính lại, mọi slot từ chỗ dính trở đi
        /// lệch hết một bậc mà vẫn "chạy được", ghi đè cả mười PNG bằng art sai không ai hay.
        /// Lệch thì dừng và trỏ sang cửa sổ Modern Art Importer để người dùng ánh xạ tay.
        /// </summary>
        [MenuItem("Sokoban/Import Modern Art")]
        public static void ImportNewest()
        {
            string source = NewestSource();
            if (source == null)
            {
                Debug.LogError($"ModernArtImporter: không thấy ảnh nào trong {SourceFolder}/");
                return;
            }

            var settings = new ModernArtImportSettings();
            var regions = FindRegionsIn(source, settings, out var sheet);

            if (regions.Count != DefaultMapping.Length)
            {
                Debug.LogError($"ModernArtImporter: dò được {regions.Count} vùng nhưng " +
                               $"DefaultMapping có {DefaultMapping.Length} ô — lệch nhau nên không " +
                               "tự ghép được, có thể hai ô đã dính do gutter hụt. Mở " +
                               "Sokoban/Modern Art Importer để xem overlay và ánh xạ tay.");
                return;
            }

            string report = Import(regions, sheet, source, DefaultMapping, settings);
            if (IsHardFailure(report))
                Debug.LogError("ModernArtImporter: " + report);
            else
                Debug.Log("ModernArtImporter: " + report);
        }
    }
}
