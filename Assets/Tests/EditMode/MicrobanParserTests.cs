using NUnit.Framework;
using Sokoban.Levels;

namespace Sokoban.Tests
{
    public class MicrobanParserTests
    {
        // Khối header của file Microban thật: không phải màn chơi, phải bị bỏ qua lặng lẽ.
        const string HeaderBlock =
            "Title: Microban\n" +
            "Description: Microban (155 puzzles)\n" +
            "             continuation line\n" +
            "Author: David W Skinner\n";

        const string OneLevel =
            "####\n" +
            "# .#\n" +
            "#  ###\n" +
            "#*@  #\n" +
            "#  $ #\n" +
            "#  ###\n" +
            "####\n" +
            "Title: 1\n";

        [Test]
        public void Parse_SkipsHeaderBlock_AndReadsLevel()
        {
            var result = MicrobanParser.Parse(HeaderBlock + "\n" + OneLevel);

            Assert.AreEqual(0, result.Errors.Count, string.Join("; ", result.Errors));
            Assert.AreEqual(1, result.Levels.Count);
        }

        [Test]
        public void Parse_TakesNameFromTitleLineAfterGrid()
        {
            var result = MicrobanParser.Parse(OneLevel);
            Assert.AreEqual("1", result.Levels[0].name);
        }

        [Test]
        public void Parse_PadsShortRowsToFullWidth()
        {
            var level = MicrobanParser.Parse(OneLevel).Levels[0];

            Assert.AreEqual(6, level.width);
            Assert.AreEqual(7, level.height);
            foreach (var row in level.rows)
                Assert.AreEqual(6, row.Length, $"row not padded: '{row}'");
            Assert.AreEqual("####  ", level.rows[0]);
        }

        [Test]
        public void Parse_AcceptsPlayerOnGoalAndBoxOnGoal()
        {
            // '+' vừa là người vừa là đích, '*' vừa là hộp vừa là đích.
            // Đếm ra: hộp = '*' + '$' + '$' = 3; đích = '+' + '*' + '.' = 3 => cân.
            const string text =
                "######\n" +
                "#+* $#\n" +
                "# $. #\n" +
                "######\n" +
                "Title: chars\n";

            var result = MicrobanParser.Parse(text);

            Assert.AreEqual(0, result.Errors.Count, string.Join("; ", result.Errors));
            Assert.AreEqual(1, result.Levels.Count);
            Assert.AreEqual("#+* $#", result.Levels[0].rows[1]);
        }

        [Test]
        public void Parse_ReportsLineNumber_WhenBoxCountDiffersFromGoals()
        {
            const string text =
                "#####\n" +
                "#@$ #\n" +   // 1 hộp, 0 đích
                "#####\n" +
                "Title: bad\n";

            var result = MicrobanParser.Parse(text);

            Assert.AreEqual(0, result.Levels.Count);
            Assert.AreEqual(1, result.Errors.Count);
            StringAssert.Contains("Line 1", result.Errors[0]);
        }

        [Test]
        public void Parse_KeepsGoodLevels_WhenOneBlockIsBroken()
        {
            const string broken =
                "#####\n" +
                "#@$ #\n" +
                "#####\n" +
                "Title: bad\n";

            var result = MicrobanParser.Parse(broken + "\n" + OneLevel);

            Assert.AreEqual(1, result.Errors.Count);
            Assert.AreEqual(1, result.Levels.Count, "một màn hỏng không được làm mất màn còn lại");
            Assert.AreEqual("1", result.Levels[0].name);
        }

        [Test]
        public void Parse_ReportsTwoPlayers()
        {
            const string text =
                "######\n" +
                "#@$.@#\n" +
                "######\n";

            var result = MicrobanParser.Parse(text);

            Assert.AreEqual(0, result.Levels.Count);
            StringAssert.Contains("player", result.Errors[0]);
        }
    }
}
