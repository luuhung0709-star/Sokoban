using System.Collections.Generic;
using System.IO;
using Sokoban.Levels;
using UnityEditor;
using UnityEngine;

namespace Sokoban.EditorTools
{
    /// <summary>Vẽ và sửa màn trong một LevelCollection bằng bảng cọ.</summary>
    public class LevelCollectionWindow : EditorWindow
    {
        enum Brush { Wall, Floor, Goal, Box, Player, Erase }

        LevelCollection _collection;
        int _levelIndex;
        Brush _brush = Brush.Wall;
        Vector2 _listScroll, _gridScroll;
        List<ValidationIssue> _issues = new List<ValidationIssue>();

        const float CellSize = 22f;

        [MenuItem("Sokoban/Level Collection Editor")]
        public static void Open() => GetWindow<LevelCollectionWindow>("Sokoban Levels");

        void OnGUI()
        {
            _collection = (LevelCollection)EditorGUILayout.ObjectField(
                "Collection", _collection, typeof(LevelCollection), false);

            if (_collection == null)
            {
                EditorGUILayout.HelpBox("Chọn một LevelCollection để bắt đầu.", MessageType.Info);
                return;
            }

            DrawToolbar();

            EditorGUILayout.BeginHorizontal();
            DrawLevelList();
            DrawGrid();
            EditorGUILayout.EndHorizontal();

            DrawIssues();
        }

        void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            if (GUILayout.Button("Thêm màn", EditorStyles.toolbarButton)) AddLevel();
            if (GUILayout.Button("Xoá màn", EditorStyles.toolbarButton)) RemoveLevel();
            if (GUILayout.Button("Lên", EditorStyles.toolbarButton)) MoveLevel(-1);
            if (GUILayout.Button("Xuống", EditorStyles.toolbarButton)) MoveLevel(1);

            GUILayout.FlexibleSpace();

            if (GUILayout.Button("Kiểm tra", EditorStyles.toolbarButton)) Validate();
            if (GUILayout.Button("Import .txt", EditorStyles.toolbarButton)) ImportText();

            EditorGUILayout.EndHorizontal();

            _brush = (Brush)GUILayout.Toolbar((int)_brush,
                new[] { "Tường", "Nền", "Đích", "Hộp", "Người", "Xoá" });
        }

        void DrawLevelList()
        {
            _listScroll = EditorGUILayout.BeginScrollView(_listScroll, GUILayout.Width(170));
            for (int i = 0; i < _collection.levels.Count; i++)
            {
                bool selected = i == _levelIndex;
                if (GUILayout.Toggle(selected, $"{i + 1}. {_collection.levels[i].name}", "Button") && !selected)
                {
                    _levelIndex = i;
                    _issues.Clear();
                }
            }
            EditorGUILayout.EndScrollView();
        }

        void DrawGrid()
        {
            if (_collection.levels.Count == 0) { EditorGUILayout.LabelField("Chưa có màn nào"); return; }

            _levelIndex = Mathf.Clamp(_levelIndex, 0, _collection.levels.Count - 1);
            var level = _collection.levels[_levelIndex];

            EditorGUILayout.BeginVertical();
            level.name = EditorGUILayout.TextField("Tên", level.name);

            int newWidth = EditorGUILayout.IntSlider("Rộng", level.width, 3, 40);
            int newHeight = EditorGUILayout.IntSlider("Cao", level.height, 3, 30);
            if (newWidth != level.width || newHeight != level.height) Resize(level, newWidth, newHeight);

            _gridScroll = EditorGUILayout.BeginScrollView(_gridScroll);
            var origin = GUILayoutUtility.GetRect(level.width * CellSize, level.height * CellSize);

            for (int y = 0; y < level.height; y++)
            {
                for (int x = 0; x < level.width; x++)
                {
                    var rect = new Rect(origin.x + x * CellSize, origin.y + y * CellSize, CellSize - 1, CellSize - 1);
                    char c = level.rows[y][x];

                    EditorGUI.DrawRect(rect, ColorFor(c));
                    if (c != SokobanChars.Floor && c != SokobanChars.Wall)
                        GUI.Label(rect, c.ToString());

                    if (Event.current.type == EventType.MouseDown && rect.Contains(Event.current.mousePosition))
                    {
                        Paint(level, x, y);
                        Event.current.Use();
                    }
                }
            }

            EditorGUILayout.EndScrollView();
            EditorGUILayout.EndVertical();
        }

        static Color ColorFor(char c) => c switch
        {
            SokobanChars.Wall => new Color(0.30f, 0.30f, 0.34f),
            SokobanChars.Goal => new Color(0.60f, 0.25f, 0.25f),
            SokobanChars.Box => new Color(0.70f, 0.55f, 0.30f),
            SokobanChars.BoxOnGoal => new Color(0.50f, 0.40f, 0.20f),
            SokobanChars.Player => new Color(0.25f, 0.55f, 0.35f),
            SokobanChars.PlayerOnGoal => new Color(0.20f, 0.45f, 0.30f),
            _ => new Color(0.85f, 0.82f, 0.78f)
        };

        void Paint(LevelData level, int x, int y)
        {
            char existing = level.rows[y][x];
            bool onGoal = existing == SokobanChars.Goal || existing == SokobanChars.BoxOnGoal ||
                          existing == SokobanChars.PlayerOnGoal;

            char next = _brush switch
            {
                Brush.Wall => SokobanChars.Wall,
                Brush.Floor => SokobanChars.Floor,
                Brush.Goal => SokobanChars.Goal,
                Brush.Box => onGoal ? SokobanChars.BoxOnGoal : SokobanChars.Box,
                Brush.Player => onGoal ? SokobanChars.PlayerOnGoal : SokobanChars.Player,
                _ => SokobanChars.Floor
            };

            // Chỉ được có một người chơi: đặt chỗ mới thì xoá chỗ cũ.
            if (next == SokobanChars.Player || next == SokobanChars.PlayerOnGoal)
                ClearExistingPlayer(level);

            SetChar(level, x, y, next);
            EditorUtility.SetDirty(_collection);
            Repaint();
        }

        static void ClearExistingPlayer(LevelData level)
        {
            for (int y = 0; y < level.height; y++)
                for (int x = 0; x < level.width; x++)
                {
                    char c = level.rows[y][x];
                    if (c == SokobanChars.Player) SetChar(level, x, y, SokobanChars.Floor);
                    else if (c == SokobanChars.PlayerOnGoal) SetChar(level, x, y, SokobanChars.Goal);
                }
        }

        static void SetChar(LevelData level, int x, int y, char c)
        {
            var chars = level.rows[y].ToCharArray();
            chars[x] = c;
            level.rows[y] = new string(chars);
        }

        static void Resize(LevelData level, int width, int height)
        {
            var rows = new string[height];
            for (int y = 0; y < height; y++)
            {
                string old = y < level.rows.Length ? level.rows[y] : "";
                rows[y] = old.Length >= width ? old.Substring(0, width) : old.PadRight(width);
            }
            level.rows = rows;
            level.width = width;
            level.height = height;
        }

        void AddLevel()
        {
            const int w = 9, h = 7;
            var rows = new string[h];
            for (int y = 0; y < h; y++)
                rows[y] = y == 0 || y == h - 1
                    ? new string(SokobanChars.Wall, w)
                    : SokobanChars.Wall + new string(SokobanChars.Floor, w - 2) + SokobanChars.Wall;

            _collection.levels.Add(new LevelData
            {
                name = $"Level {_collection.levels.Count + 1}",
                width = w,
                height = h,
                rows = rows
            });
            _levelIndex = _collection.levels.Count - 1;
            EditorUtility.SetDirty(_collection);
        }

        void RemoveLevel()
        {
            if (_collection.levels.Count == 0) return;
            _collection.levels.RemoveAt(_levelIndex);
            _levelIndex = Mathf.Max(0, _levelIndex - 1);
            EditorUtility.SetDirty(_collection);
        }

        void MoveLevel(int offset)
        {
            int target = _levelIndex + offset;
            if (target < 0 || target >= _collection.levels.Count) return;

            var tmp = _collection.levels[_levelIndex];
            _collection.levels[_levelIndex] = _collection.levels[target];
            _collection.levels[target] = tmp;
            _levelIndex = target;
            EditorUtility.SetDirty(_collection);
        }

        void Validate()
        {
            if (_collection.levels.Count == 0) return;
            _issues = LevelValidator.Validate(_collection.levels[_levelIndex]);
        }

        void ImportText()
        {
            string path = EditorUtility.OpenFilePanel("Chọn file màn", "Assets", "txt");
            if (string.IsNullOrEmpty(path)) return;

            int count = MicrobanImporter.ImportTextIntoCollection(File.ReadAllText(path), _collection);
            EditorUtility.SetDirty(_collection);
            AssetDatabase.SaveAssets();
            Debug.Log($"LevelCollectionWindow: nạp {count} màn");
        }

        void DrawIssues()
        {
            if (_issues.Count == 0) return;

            foreach (var issue in _issues)
                EditorGUILayout.HelpBox(issue.Message, MessageType.Error);
        }
    }
}
