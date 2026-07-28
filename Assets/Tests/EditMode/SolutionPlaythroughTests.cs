using NUnit.Framework;
using Sokoban.Core;

namespace Sokoban.Tests
{
    public class SolutionPlaythroughTests
    {
        static void Play(GameSession session, string moves)
        {
            foreach (char c in moves)
            {
                var dir = c switch
                {
                    'U' => Direction.Up,
                    'D' => Direction.Down,
                    'L' => Direction.Left,
                    'R' => Direction.Right,
                    _ => throw new AssertionException($"ký tự hướng lạ: {c}")
                };
                Assert.IsTrue(session.TryMove(dir), $"nước '{c}' bị chặn ngoài dự kiến");
            }
        }

        [Test]
        public void SinglePush_Solves()
        {
            var s = new GameSession(BoardTests.Level(
                "#####",
                "#@$.#",
                "#####"));

            Play(s, "R");
            Assert.IsTrue(s.IsSolved);
        }

        [Test]
        public void TwoBoxes_SolveInSequence()
        {
            //   0123456
            // 0 #######
            // 1 #@$  .#     hộp (2,1) đẩy sang đích (5,1)
            // 2 #     #
            // 3 # $  .#     hộp (2,3) đẩy sang đích (5,3)
            // 4 #######
            //
            // Hai hộp nằm khác hàng nên người chơi vòng được ra sau hộp thứ hai;
            // xếp hai hộp cùng một hàng sẽ tự chặn đường và không giải nổi.
            var s = new GameSession(BoardTests.Level(
                "#######",
                "#@$  .#",
                "#     #",
                "# $  .#",
                "#######"));

            Play(s, "RRR");          // đẩy hộp trên vào đích (5,1)
            Assert.IsFalse(s.IsSolved, "mới xong một hộp");

            Play(s, "DLLLD");        // vòng xuống hàng dưới, ra phía trái hộp thứ hai
            Play(s, "RRR");          // đẩy hộp dưới vào đích (5,3)

            Assert.IsTrue(s.IsSolved);
            Assert.AreEqual(11, s.Moves);
            Assert.AreEqual(6, s.Pushes);
        }

        [Test]
        public void PushDownwards_Solves()
        {
            //   01234
            // 0 #####
            // 1 #@  #
            // 2 # $ #
            // 3 # . #
            // 4 #####
            //
            // Người ở (1,1) đi phải tới (2,1) — ngay trên hộp — rồi đẩy xuống đích (2,3).
            var s = new GameSession(BoardTests.Level(
                "#####",
                "#@  #",
                "# $ #",
                "# . #",
                "#####"));

            Play(s, "RD");

            Assert.IsTrue(s.IsSolved);
            Assert.AreEqual(1, s.Pushes);
        }

        [Test]
        public void UndoAfterSolving_LosesSolvedState()
        {
            var s = new GameSession(BoardTests.Level(
                "#####",
                "#@$.#",
                "#####"));

            Play(s, "R");
            Assert.IsTrue(s.IsSolved);

            s.TryUndo();
            Assert.IsFalse(s.IsSolved);
        }
    }
}
