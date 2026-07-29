using System.Collections.Generic;
using UnityEngine;

namespace Sokoban.Levels
{
    public class ValidationIssue
    {
        public string Message;
        public ValidationIssue(string message) => Message = message;
    }

    /// <summary>Kiểm tra cấu trúc một màn. Không kiểm tra màn có giải được hay không.</summary>
    public static class LevelValidator
    {
        public static List<ValidationIssue> Validate(LevelData level)
        {
            var issues = new List<ValidationIssue>();
            if (level == null || level.rows == null || level.rows.Length == 0)
            {
                issues.Add(new ValidationIssue("Màn rỗng"));
                return issues;
            }

            int players = 0, boxes = 0, goals = 0;
            Vector2Int playerPos = default;

            for (int y = 0; y < level.rows.Length; y++)
            {
                string row = level.rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    char c = row[x];
                    if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal)
                    {
                        players++;
                        playerPos = new Vector2Int(x, y);
                    }
                    if (c == SokobanChars.Box || c == SokobanChars.BoxOnGoal) boxes++;
                    if (c == SokobanChars.Goal || c == SokobanChars.BoxOnGoal ||
                        c == SokobanChars.PlayerOnGoal) goals++;
                }
            }

            if (players != 1)
                issues.Add(new ValidationIssue($"Phải có đúng một người chơi, đang có {players}"));
            if (boxes == 0)
                issues.Add(new ValidationIssue("Màn không có hộp nào"));
            else if (boxes != goals)
                issues.Add(new ValidationIssue($"Số hộp ({boxes}) khác số đích ({goals})"));

            if (players == 1 && !IsEnclosed(level, playerPos))
                issues.Add(new ValidationIssue("Vùng chơi chưa kín — người chơi đi ra ngoài lưới được"));

            return issues;
        }

        static bool IsEnclosed(LevelData level, Vector2Int start)
        {
            int height = level.rows.Length;
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
                    if (n.y < 0 || n.y >= height) return false;

                    string row = level.rows[n.y];
                    if (n.x < 0 || n.x >= row.Length) return false;

                    if (row[n.x] == SokobanChars.Wall || seen.Contains(n)) continue;
                    seen.Add(n);
                    queue.Enqueue(n);
                }
            }

            return true;
        }
    }
}
