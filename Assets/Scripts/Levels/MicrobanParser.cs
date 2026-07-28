using System.Collections.Generic;

namespace Sokoban.Levels
{
    public class ParseResult
    {
        public readonly List<LevelData> Levels = new List<LevelData>();
        public readonly List<string> Errors = new List<string>();
    }

    public static class MicrobanParser
    {
        const string TitlePrefix = "Title:";

        public static ParseResult Parse(string text)
        {
            var result = new ParseResult();
            if (string.IsNullOrEmpty(text)) return result;

            var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

            int i = 0;
            while (i < lines.Length)
            {
                while (i < lines.Length && lines[i].Trim().Length == 0) i++;
                if (i >= lines.Length) break;

                int blockStartLine = i + 1;          // số dòng 1-based cho thông báo lỗi
                var block = new List<string>();
                while (i < lines.Length && lines[i].Trim().Length != 0)
                {
                    block.Add(lines[i]);
                    i++;
                }

                TryAddLevel(block, blockStartLine, result);
            }

            return result;
        }

        static void TryAddLevel(List<string> block, int blockStartLine, ParseResult result)
        {
            var rows = new List<string>();
            string name = null;

            foreach (var line in block)
            {
                if (line.StartsWith(TitlePrefix))
                {
                    name = line.Substring(TitlePrefix.Length).Trim();
                    continue;
                }
                if (IsGridLine(line)) rows.Add(line);
            }

            // Khối header không có hàng lưới nào — bỏ qua, đây không phải lỗi.
            if (rows.Count == 0) return;

            int players = 0, boxes = 0, goals = 0;
            foreach (var row in rows)
            {
                foreach (var c in row)
                {
                    if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal) players++;
                    if (c == SokobanChars.Box || c == SokobanChars.BoxOnGoal) boxes++;
                    if (c == SokobanChars.Goal || c == SokobanChars.BoxOnGoal ||
                        c == SokobanChars.PlayerOnGoal) goals++;
                }
            }

            if (players != 1)
            {
                result.Errors.Add($"Line {blockStartLine}: expected exactly 1 player, found {players}");
                return;
            }
            if (boxes == 0)
            {
                result.Errors.Add($"Line {blockStartLine}: level has no boxes");
                return;
            }
            if (boxes != goals)
            {
                result.Errors.Add($"Line {blockStartLine}: {boxes} boxes but {goals} goals");
                return;
            }

            int width = 0;
            foreach (var row in rows)
                if (row.Length > width) width = row.Length;

            var padded = new string[rows.Count];
            for (int r = 0; r < rows.Count; r++) padded[r] = rows[r].PadRight(width);

            result.Levels.Add(new LevelData
            {
                name = string.IsNullOrEmpty(name) ? $"Level {result.Levels.Count + 1}" : name,
                width = width,
                height = rows.Count,
                rows = padded
            });
        }

        /// <summary>Hàng lưới = chỉ gồm 7 ký tự hợp lệ và có ít nhất một ký tự khác dấu cách.</summary>
        static bool IsGridLine(string line)
        {
            bool hasContent = false;
            foreach (var c in line)
            {
                if (!SokobanChars.IsGrid(c)) return false;
                if (SokobanChars.IsContent(c)) hasContent = true;
            }
            return hasContent;
        }
    }
}
