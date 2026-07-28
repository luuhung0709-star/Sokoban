using System.Collections.Generic;
using NUnit.Framework;
using Sokoban.Levels;
using UnityEditor;
using UnityEngine;

namespace Sokoban.Tests
{
    public class MicrobanRegressionTests
    {
        const string CollectionPath = "Assets/Levels/Microban.asset";

        static LevelCollection LoadCollection()
        {
            var c = AssetDatabase.LoadAssetAtPath<LevelCollection>(CollectionPath);
            Assert.IsNotNull(c, $"chưa có asset {CollectionPath} — chạy menu Sokoban/Import Microban .txt…");
            return c;
        }

        [Test]
        public void Collection_HasAll155Levels()
        {
            Assert.AreEqual(155, LoadCollection().levels.Count);
        }

        [Test]
        public void EveryLevel_HasOnePlayerAndMatchingBoxesAndGoals()
        {
            foreach (var level in LoadCollection().levels)
            {
                int players = 0, boxes = 0, goals = 0;
                foreach (var row in level.rows)
                {
                    foreach (var c in row)
                    {
                        if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal) players++;
                        if (c == SokobanChars.Box || c == SokobanChars.BoxOnGoal) boxes++;
                        if (c == SokobanChars.Goal || c == SokobanChars.BoxOnGoal ||
                            c == SokobanChars.PlayerOnGoal) goals++;
                    }
                }

                Assert.AreEqual(1, players, $"màn '{level.name}' phải có đúng 1 người chơi");
                Assert.AreEqual(goals, boxes, $"màn '{level.name}' lệch số hộp và đích");
                Assert.Greater(boxes, 0, $"màn '{level.name}' không có hộp nào");
            }
        }

        [Test]
        public void EveryLevel_HasRowsPaddedToWidth()
        {
            foreach (var level in LoadCollection().levels)
            {
                Assert.AreEqual(level.height, level.rows.Length, $"màn '{level.name}' lệch height");
                foreach (var row in level.rows)
                    Assert.AreEqual(level.width, row.Length, $"màn '{level.name}' có hàng chưa pad");
            }
        }

        [Test]
        public void EveryLevel_IsEnclosedByWalls()
        {
            // Loang từ người chơi qua mọi ô không phải tường; không được thoát ra ngoài lưới.
            //
            // Phép loang này CỐ Ý viết lại độc lập, không gọi LevelValidator (Task 13):
            // đây là test dữ liệu, nó phải kiểm tra 155 màn thật chứ không đo lại chính
            // đoạn code mà một test khác đã kiểm. Đừng gộp hai chỗ này làm một.
            foreach (var level in LoadCollection().levels)
            {
                Vector2Int start = default;
                bool found = false;
                for (int y = 0; y < level.height && !found; y++)
                    for (int x = 0; x < level.width && !found; x++)
                    {
                        char c = level.rows[y][x];
                        if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal)
                        {
                            start = new Vector2Int(x, y);
                            found = true;
                        }
                    }
                Assert.IsTrue(found, $"màn '{level.name}' không tìm thấy người chơi");

                var seen = new HashSet<Vector2Int> { start };
                var queue = new Queue<Vector2Int>();
                queue.Enqueue(start);
                var deltas = new[]
                {
                    new Vector2Int(1, 0), new Vector2Int(-1, 0),
                    new Vector2Int(0, 1), new Vector2Int(0, -1)
                };

                while (queue.Count > 0)
                {
                    var p = queue.Dequeue();
                    foreach (var d in deltas)
                    {
                        var n = p + d;
                        bool outside = n.x < 0 || n.x >= level.width || n.y < 0 || n.y >= level.height;
                        Assert.IsFalse(outside, $"màn '{level.name}' hở — người chơi đi ra ngoài lưới được");
                        if (level.rows[n.y][n.x] == SokobanChars.Wall || seen.Contains(n)) continue;
                        seen.Add(n);
                        queue.Enqueue(n);
                    }
                }
            }
        }
    }
}
