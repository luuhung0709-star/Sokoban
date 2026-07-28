using NUnit.Framework;
using Sokoban.Core;
using Sokoban.Levels;
using UnityEngine;

namespace Sokoban.Tests
{
    public class BoardTests
    {
        internal static LevelData Level(params string[] rows)
        {
            int width = 0;
            foreach (var r in rows) if (r.Length > width) width = r.Length;
            var padded = new string[rows.Length];
            for (int i = 0; i < rows.Length; i++) padded[i] = rows[i].PadRight(width);
            return new LevelData { name = "test", width = width, height = rows.Length, rows = padded };
        }

        [Test]
        public void FromLevel_ReadsPlayerBoxesAndStatics()
        {
            var board = Board.FromLevel(Level(
                "#####",
                "#@$.#",
                "#####"));

            Assert.AreEqual(new Vector2Int(1, 1), board.PlayerPos);
            Assert.AreEqual(1, board.Boxes.Count);
            Assert.IsTrue(board.Boxes.Contains(new Vector2Int(2, 1)));
            Assert.AreEqual(CellType.Wall, board.GetCell(new Vector2Int(0, 0)));
            Assert.AreEqual(CellType.Floor, board.GetCell(new Vector2Int(1, 1)));
            Assert.AreEqual(CellType.Goal, board.GetCell(new Vector2Int(3, 1)));
        }

        [Test]
        public void FromLevel_TreatsPlayerOnGoalAndBoxOnGoalAsGoalCells()
        {
            var board = Board.FromLevel(Level(
                "#####",
                "#+* #",
                "#####"));

            Assert.AreEqual(CellType.Goal, board.GetCell(new Vector2Int(1, 1)));
            Assert.AreEqual(CellType.Goal, board.GetCell(new Vector2Int(2, 1)));
            Assert.AreEqual(new Vector2Int(1, 1), board.PlayerPos);
            Assert.IsTrue(board.Boxes.Contains(new Vector2Int(2, 1)));
        }

        [Test]
        public void GetCell_OutsideGrid_IsWall()
        {
            var board = Board.FromLevel(Level(
                "###",
                "#@#",
                "###"));

            Assert.AreEqual(CellType.Wall, board.GetCell(new Vector2Int(-1, 0)));
            Assert.AreEqual(CellType.Wall, board.GetCell(new Vector2Int(0, 99)));
        }

        [Test]
        public void IsSolved_TrueOnlyWhenEveryBoxSitsOnAGoal()
        {
            var unsolved = Board.FromLevel(Level(
                "#####",
                "#@$.#",
                "#####"));
            Assert.IsFalse(unsolved.IsSolved);

            var solved = Board.FromLevel(Level(
                "#####",
                "#@ *#",
                "#####"));
            Assert.IsTrue(solved.IsSolved);
        }
    }
}
