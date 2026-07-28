using System.Collections.Generic;
using Sokoban.Levels;
using UnityEngine;

namespace Sokoban.Core
{
    /// <summary>Trạng thái một màn đang chơi. Lưới tĩnh không đổi; người chơi và hộp thì đổi.</summary>
    public class Board
    {
        readonly CellType[,] _statics;

        public int Width { get; }
        public int Height { get; }
        public Vector2Int PlayerPos { get; set; }
        public HashSet<Vector2Int> Boxes { get; }

        Board(int width, int height)
        {
            Width = width;
            Height = height;
            _statics = new CellType[width, height];
            Boxes = new HashSet<Vector2Int>();
        }

        /// <summary>Ngoài lưới coi như tường, nên nơi khác không cần kiểm tra biên.</summary>
        public CellType GetCell(Vector2Int p) =>
            p.x < 0 || p.x >= Width || p.y < 0 || p.y >= Height
                ? CellType.Wall
                : _statics[p.x, p.y];

        public bool HasBox(Vector2Int p) => Boxes.Contains(p);

        public bool IsSolved
        {
            get
            {
                foreach (var b in Boxes)
                    if (GetCell(b) != CellType.Goal) return false;
                return true;
            }
        }

        public static Board FromLevel(LevelData level)
        {
            var board = new Board(level.width, level.height);

            for (int y = 0; y < level.height; y++)
            {
                string row = level.rows[y];
                for (int x = 0; x < level.width; x++)
                {
                    char c = x < row.Length ? row[x] : SokobanChars.Floor;
                    var pos = new Vector2Int(x, y);

                    board._statics[x, y] = c == SokobanChars.Wall ? CellType.Wall
                        : c == SokobanChars.Goal || c == SokobanChars.BoxOnGoal ||
                          c == SokobanChars.PlayerOnGoal ? CellType.Goal
                        : CellType.Floor;

                    if (c == SokobanChars.Player || c == SokobanChars.PlayerOnGoal)
                        board.PlayerPos = pos;
                    if (c == SokobanChars.Box || c == SokobanChars.BoxOnGoal)
                        board.Boxes.Add(pos);
                }
            }

            return board;
        }
    }
}
