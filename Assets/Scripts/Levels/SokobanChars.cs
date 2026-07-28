namespace Sokoban.Levels
{
    /// <summary>Bảy ký tự của định dạng Sokoban chuẩn.</summary>
    public static class SokobanChars
    {
        public const char Wall = '#';
        public const char Floor = ' ';
        public const char Player = '@';
        public const char PlayerOnGoal = '+';
        public const char Box = '$';
        public const char BoxOnGoal = '*';
        public const char Goal = '.';

        public static bool IsGrid(char c) =>
            c == Wall || c == Floor || c == Player || c == PlayerOnGoal ||
            c == Box || c == BoxOnGoal || c == Goal;

        /// <summary>Ký tự lưới khác nền trống — dùng để phân biệt hàng lưới với dòng chữ.</summary>
        public static bool IsContent(char c) => IsGrid(c) && c != Floor;
    }
}
