using UnityEngine;

namespace Sokoban.Core
{
    public enum MoveKind { Blocked, Walk, Push }

    public struct MoveResult
    {
        public MoveKind Kind;
        public Direction Dir;
        public Vector2Int PlayerFrom;
        public Vector2Int PlayerTo;
        public Vector2Int BoxFrom;
        public Vector2Int BoxTo;

        public bool IsPush => Kind == MoveKind.Push;
        public bool IsBlocked => Kind == MoveKind.Blocked;
    }
}
