using System;

namespace Sokoban.Levels
{
    [Serializable]
    public class LevelData
    {
        public string name;
        public int width;
        public int height;
        /// <summary>Mỗi phần tử là một hàng, đã pad bằng dấu cách cho đủ <see cref="width"/>.</summary>
        public string[] rows;
    }
}
