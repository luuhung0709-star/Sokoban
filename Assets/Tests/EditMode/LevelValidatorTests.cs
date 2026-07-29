using NUnit.Framework;
using Sokoban.Levels;

namespace Sokoban.Tests
{
    public class LevelValidatorTests
    {
        [Test]
        public void ValidLevel_HasNoIssues()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "#####",
                "#@$.#",
                "#####"));

            Assert.AreEqual(0, issues.Count, string.Join("; ", issues.ConvertAll(i => i.Message)));
        }

        [Test]
        public void NoPlayer_IsReported()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "#####",
                "# $.#",
                "#####"));

            Assert.AreEqual(1, issues.Count);
            StringAssert.Contains("người chơi", issues[0].Message);
        }

        [Test]
        public void TwoPlayers_AreReported()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "######",
                "#@$.@#",
                "######"));

            StringAssert.Contains("người chơi", issues[0].Message);
        }

        [Test]
        public void BoxGoalMismatch_IsReported()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "######",
                "#@$$.#",
                "######"));

            Assert.AreEqual(1, issues.Count);
            StringAssert.Contains("hộp", issues[0].Message);
        }

        [Test]
        public void OpenBoundary_IsReported()
        {
            // Thiếu tường bên phải nên người chơi đi ra ngoài lưới được.
            var issues = LevelValidator.Validate(BoardTests.Level(
                "#####",
                "#@$. ",
                "#####"));

            Assert.AreEqual(1, issues.Count);
            StringAssert.Contains("kín", issues[0].Message);
        }

        [Test]
        public void NoBoxes_IsReported()
        {
            var issues = LevelValidator.Validate(BoardTests.Level(
                "#####",
                "#@  #",
                "#####"));

            StringAssert.Contains("hộp", issues[0].Message);
        }
    }
}
