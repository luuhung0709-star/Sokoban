using NUnit.Framework;
using Sokoban.Core;
using UnityEngine;

namespace Sokoban.Tests
{
    public class MoveResolverTests
    {
        [Test]
        public void Walk_IntoEmptyFloor()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "#####",
                "#@  #",
                "#####"));

            var move = MoveResolver.Resolve(board, Direction.Right);

            Assert.AreEqual(MoveKind.Walk, move.Kind);
            Assert.AreEqual(new Vector2Int(2, 1), move.PlayerTo);
        }

        [Test]
        public void Blocked_ByWall()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "###",
                "#@#",
                "###"));

            Assert.AreEqual(MoveKind.Blocked, MoveResolver.Resolve(board, Direction.Right).Kind);
            Assert.AreEqual(MoveKind.Blocked, MoveResolver.Resolve(board, Direction.Up).Kind);
        }

        [Test]
        public void Push_MovesBoxOneCell()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "######",
                "#@$ .#",
                "######"));

            var move = MoveResolver.Resolve(board, Direction.Right);

            Assert.AreEqual(MoveKind.Push, move.Kind);
            Assert.AreEqual(new Vector2Int(2, 1), move.PlayerTo);
            Assert.AreEqual(new Vector2Int(2, 1), move.BoxFrom);
            Assert.AreEqual(new Vector2Int(3, 1), move.BoxTo);
        }

        [Test]
        public void Push_BlockedWhenBoxFacesWall()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "#####",
                "#@$.#",   // hộp ở (2,1), sau nó là đích (3,1) => đẩy được
                "#####"));
            Assert.AreEqual(MoveKind.Push, MoveResolver.Resolve(board, Direction.Right).Kind);

            var tight = Board.FromLevel(BoardTests.Level(
                "####",
                "#@$#",   // sau hộp là tường => chặn
                "####"));
            Assert.AreEqual(MoveKind.Blocked, MoveResolver.Resolve(tight, Direction.Right).Kind);
        }

        [Test]
        public void Push_BlockedWhenTwoBoxesAreAdjacent()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "#######",
                "#@$$ .#",
                "#######"));

            Assert.AreEqual(MoveKind.Blocked, MoveResolver.Resolve(board, Direction.Right).Kind);
        }

        [Test]
        public void Up_DecreasesY_AndDown_IncreasesY()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "###",
                "# #",
                "#@#",
                "# #",
                "###"));

            Assert.AreEqual(new Vector2Int(1, 1), MoveResolver.Resolve(board, Direction.Up).PlayerTo);
            Assert.AreEqual(new Vector2Int(1, 3), MoveResolver.Resolve(board, Direction.Down).PlayerTo);
        }

        [Test]
        public void Apply_ThenRevert_RestoresBoardExactly()
        {
            var board = Board.FromLevel(BoardTests.Level(
                "######",
                "#@$ .#",
                "######"));

            var before = board.PlayerPos;
            var move = MoveResolver.Resolve(board, Direction.Right);

            MoveResolver.Apply(board, move);
            Assert.AreEqual(new Vector2Int(2, 1), board.PlayerPos);
            Assert.IsTrue(board.Boxes.Contains(new Vector2Int(3, 1)));

            MoveResolver.Revert(board, move);
            Assert.AreEqual(before, board.PlayerPos);
            Assert.IsTrue(board.Boxes.Contains(new Vector2Int(2, 1)));
            Assert.AreEqual(1, board.Boxes.Count);
        }

        [Test]
        public void PushingBoxOffAGoal_LosesSolvedState()
        {
            // Đúng 1 hộp và 1 đích, hộp đang đứng trên đích ở (2,1) => đang thắng.
            var board = Board.FromLevel(BoardTests.Level(
                "#####",
                "#@* #",
                "#####"));

            Assert.IsTrue(board.IsSolved, "hộp đang nằm trên đích duy nhất");

            MoveResolver.Apply(board, MoveResolver.Resolve(board, Direction.Right));

            Assert.IsFalse(board.IsSolved, "đẩy hộp ra khỏi đích thì mất trạng thái thắng");
            Assert.AreEqual(CellType.Goal, board.GetCell(new Vector2Int(2, 1)),
                            "ô đích vẫn là đích sau khi hộp rời đi");
        }
    }
}
