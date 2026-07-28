using UnityEngine;

namespace Sokoban.Core
{
    public enum Direction { Up, Down, Left, Right }

    public static class DirectionExtensions
    {
        /// <summary>y tăng xuống dưới, nên Up là -1 theo trục y.</summary>
        public static Vector2Int ToDelta(this Direction d) => d switch
        {
            Direction.Up => new Vector2Int(0, -1),
            Direction.Down => new Vector2Int(0, 1),
            Direction.Left => new Vector2Int(-1, 0),
            _ => new Vector2Int(1, 0)
        };

        public static Direction Opposite(this Direction d) => d switch
        {
            Direction.Up => Direction.Down,
            Direction.Down => Direction.Up,
            Direction.Left => Direction.Right,
            _ => Direction.Left
        };
    }
}
