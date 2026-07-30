using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Sokoban.EditorTools
{
    /// <summary>
    /// Xem trước các vùng dò được trên sheet rồi mới ghi đè asset. Cần nó vì Gemini xếp
    /// lưới khác nhau giữa các lần sinh, và vì mấy hằng số màu phải chỉnh bằng mắt.
    /// </summary>
    public class ModernArtImporterWindow : EditorWindow
    {
        const string MappingKey = "Sokoban.ModernArt.Mapping";

        string _sourcePath;
        Texture2D _preview;
        List<RectInt> _regions = new List<RectInt>();
        ArtSlot[] _mapping = (ArtSlot[])ModernArtImporter.DefaultMapping.Clone();
        ModernArtImportSettings _settings = new ModernArtImportSettings();
        Vector2 _scroll;
        string _report;

        [MenuItem("Sokoban/Modern Art Importer")]
        public static void Open() => GetWindow<ModernArtImporterWindow>("Modern Art");

        void OnEnable()
        {
            _sourcePath = ModernArtImporter.NewestSource();
            LoadMapping();
            if (_sourcePath != null) Scan();
        }

        void OnGUI()
        {
            _scroll = EditorGUILayout.BeginScrollView(_scroll);

            DrawSourceRow();

            if (_sourcePath == null)
            {
                EditorGUILayout.HelpBox(
                    $"Không thấy ảnh nào trong {ModernArtImporter.SourceFolder}/. " +
                    "Tải sheet từ Gemini về đó rồi bấm Dò lại.", MessageType.Info);
                EditorGUILayout.EndScrollView();
                return;
            }

            DrawSettings();
            DrawPreview();
            DrawMapping();
            DrawImportRow();

            EditorGUILayout.EndScrollView();
        }

        void DrawSourceRow()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            GUILayout.Label(_sourcePath == null ? "(chưa có ảnh)" : Path.GetFileName(_sourcePath));
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Dò lại", EditorStyles.toolbarButton))
            {
                _sourcePath = ModernArtImporter.NewestSource();
                if (_sourcePath != null) Scan();
            }
            EditorGUILayout.EndHorizontal();
        }

        void DrawSettings()
        {
            EditorGUILayout.LabelField("Tách nền", EditorStyles.boldLabel);
            _settings.backgroundTolerance =
                EditorGUILayout.IntSlider("Ngưỡng nền", _settings.backgroundTolerance, 5, 80);
            _settings.despillBand =
                EditorGUILayout.IntSlider("Dải khử ám", _settings.despillBand, 0, 5);
            _settings.despillWholeSprite = EditorGUILayout.Toggle(
                new GUIContent("Khử ám toàn sprite",
                    "Bật thì quét khử ám hồng/tím trên toàn bộ sprite thay vì chỉ dải sát mép " +
                    "trong suốt. Cần bật để xoá mảng bóng tím đặc dưới chân nhân vật."),
                _settings.despillWholeSprite);
            _settings.minAreaRatio =
                EditorGUILayout.Slider("Ngưỡng loại đốm", _settings.minAreaRatio, 0.02f, 0.9f);

            EditorGUILayout.LabelField("Màu suy ra", EditorStyles.boldLabel);
            _settings.floorALevel = EditorGUILayout.Slider("Sàn tông A", _settings.floorALevel, 0.2f, 1f);
            _settings.floorBLevel = EditorGUILayout.Slider("Sàn tông B", _settings.floorBLevel, 0.2f, 1f);
            _settings.boxOnGoalTint = EditorGUILayout.ColorField("Tint hộp đích", _settings.boxOnGoalTint);
            _settings.boxOnGoalTintAmount =
                EditorGUILayout.Slider("Độ tint", _settings.boxOnGoalTintAmount, 0f, 1f);
            _settings.objectScale = EditorGUILayout.Slider("Cỡ vật thể", _settings.objectScale, 0.5f, 1.5f);

            EditorGUILayout.HelpBox(
                "Đổi ngưỡng nền hoặc ngưỡng loại đốm thì bấm Dò lại để cập nhật khung xem trước. " +
                "Không dò tự động vì mỗi lần dò phải quét hết 4.3 triệu pixel, kéo thanh trượt sẽ đứng hình.",
                MessageType.None);
        }

        void DrawPreview()
        {
            if (_preview == null) return;

            float width = Mathf.Min(position.width - 20f, 420f);
            float scale = width / _preview.width;
            var rect = GUILayoutUtility.GetRect(width, _preview.height * scale);

            GUI.DrawTexture(rect, _preview, ScaleMode.ScaleToFit);

            for (int i = 0; i < _regions.Count; i++)
            {
                var r = _regions[i];
                var box = new Rect(rect.x + r.x * scale, rect.y + r.y * scale,
                                   r.width * scale, r.height * scale);
                Handles.DrawSolidRectangleWithOutline(box, Color.clear, Color.cyan);
                GUI.Label(new Rect(box.x + 2, box.y + 2, 120, 16), $"{i}: {SlotAt(i)}");
            }
        }

        void DrawMapping()
        {
            EditorGUILayout.LabelField($"Ánh xạ {_regions.Count} vùng", EditorStyles.boldLabel);
            EnsureMappingLength();

            for (int i = 0; i < _regions.Count; i++)
            {
                var r = _regions[i];
                _mapping[i] = (ArtSlot)EditorGUILayout.EnumPopup(
                    $"Vùng {i} ({r.width}x{r.height})", _mapping[i]);
            }
        }

        void DrawImportRow()
        {
            EditorGUILayout.Space();
            if (GUILayout.Button("Import — ghi đè Assets/Art/Modern", GUILayout.Height(28)))
            {
                SaveMapping();
                _report = ModernArtImporter.Import(_sourcePath, _mapping, _settings);
                Debug.Log("ModernArtImporter: " + _report);
            }

            if (!string.IsNullOrEmpty(_report))
                EditorGUILayout.HelpBox(_report,
                    _report.Contains("THIẾU") ? MessageType.Warning : MessageType.Info);
        }

        ArtSlot SlotAt(int i) => i < _mapping.Length ? _mapping[i] : ArtSlot.Skip;

        void Scan()
        {
            _regions = ModernArtImporter.FindRegionsIn(_sourcePath, _settings, out _);
            EnsureMappingLength();
            BuildPreview();
        }

        void EnsureMappingLength()
        {
            if (_mapping.Length >= _regions.Count) return;

            var grown = new ArtSlot[_regions.Count];
            System.Array.Copy(_mapping, grown, _mapping.Length);
            _mapping = grown;
        }

        void BuildPreview()
        {
            if (_preview != null) DestroyImmediate(_preview);

            _preview = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            ImageConversion.LoadImage(_preview, File.ReadAllBytes(_sourcePath));
            _preview.filterMode = FilterMode.Bilinear;
        }

        void LoadMapping()
        {
            string saved = EditorPrefs.GetString(MappingKey, "");
            if (string.IsNullOrEmpty(saved)) return;

            var parts = saved.Split(',');
            var loaded = new ArtSlot[parts.Length];
            for (int i = 0; i < parts.Length; i++)
                loaded[i] = System.Enum.TryParse(parts[i], out ArtSlot slot) ? slot : ArtSlot.Skip;

            _mapping = loaded;
        }

        void SaveMapping() =>
            EditorPrefs.SetString(MappingKey, string.Join(",", _mapping));

        void OnDisable()
        {
            if (_preview != null) DestroyImmediate(_preview);
        }
    }
}
