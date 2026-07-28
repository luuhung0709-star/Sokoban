using NUnit.Framework;
using Sokoban.Core;
using UnityEngine;

namespace Sokoban.Tests
{
    public class MoveHistoryTests
    {
        static GameSession Session() => new GameSession(BoardTests.Level(
            "########",
            "#@$  . #",
            "########"));

        [Test]
        public void Undo_RestoresPreviousState_IncludingPushedBox()
        {
            var s = Session();
            s.TryMove(Direction.Right);           // đẩy hộp từ (2,1) sang (3,1)

            Assert.AreEqual(new Vector2Int(2, 1), s.Board.PlayerPos);
            Assert.IsTrue(s.Board.Boxes.Contains(new Vector2Int(3, 1)));

            Assert.IsTrue(s.TryUndo());
            Assert.AreEqual(new Vector2Int(1, 1), s.Board.PlayerPos);
            Assert.IsTrue(s.Board.Boxes.Contains(new Vector2Int(2, 1)));
        }

        [Test]
        public void UndoAll_ReturnsToStartingPosition()
        {
            var s = Session();
            var startPlayer = s.Board.PlayerPos;

            s.TryMove(Direction.Right);
            s.TryMove(Direction.Right);
            s.TryMove(Direction.Right);
            while (s.TryUndo()) { }

            Assert.AreEqual(startPlayer, s.Board.PlayerPos);
            Assert.IsTrue(s.Board.Boxes.Contains(new Vector2Int(2, 1)));
            Assert.AreEqual(0, s.Moves);
            Assert.AreEqual(0, s.Pushes);
        }

        [Test]
        public void Redo_ReplaysTheUndoneMove()
        {
            var s = Session();
            s.TryMove(Direction.Right);
            s.TryUndo();

            Assert.IsTrue(s.TryRedo());
            Assert.AreEqual(new Vector2Int(2, 1), s.Board.PlayerPos);
            Assert.IsTrue(s.Board.Boxes.Contains(new Vector2Int(3, 1)));
        }

        [Test]
        public void NewMove_ClearsTheRedoBranch()
        {
            var s = Session();
            s.TryMove(Direction.Right);
            s.TryUndo();
            s.TryMove(Direction.Down);   // bị tường chặn, không được coi là nước đi

            Assert.IsTrue(s.TryRedo(), "nước bị chặn không được xoá nhánh redo");

            s.TryUndo();
            s.TryMove(Direction.Right);  // nước đi thật => xoá nhánh redo
            Assert.IsFalse(s.TryRedo());
        }

        [Test]
        public void BlockedMove_DoesNotCount()
        {
            var s = Session();
            Assert.IsFalse(s.TryMove(Direction.Up));
            Assert.AreEqual(0, s.Moves);
            Assert.IsFalse(s.TryUndo());
        }

        [Test]
        public void Counters_TrackMovesAndPushesSeparately()
        {
            var s = Session();
            s.TryMove(Direction.Right);   // đẩy
            s.TryMove(Direction.Right);   // đẩy tiếp

            Assert.AreEqual(2, s.Moves);
            Assert.AreEqual(2, s.Pushes);

            s.TryUndo();
            Assert.AreEqual(1, s.Moves);
            Assert.AreEqual(1, s.Pushes);
        }

        [Test]
        public void Restart_ResetsBoardAndCounters()
        {
            var s = Session();
            s.TryMove(Direction.Right);
            s.Restart();

            Assert.AreEqual(new Vector2Int(1, 1), s.Board.PlayerPos);
            Assert.AreEqual(0, s.Moves);
            Assert.IsFalse(s.TryUndo());
            Assert.IsFalse(s.TryRedo());
        }
    }
}
