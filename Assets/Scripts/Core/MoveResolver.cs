namespace Sokoban.Core
{
    public static class MoveResolver
    {
        /// <summary>Tính kết quả một nước đi. Hàm thuần — không đổi board.</summary>
        public static MoveResult Resolve(Board board, Direction dir)
        {
            var delta = dir.ToDelta();
            var from = board.PlayerPos;
            var to = from + delta;

            var result = new MoveResult
            {
                Kind = MoveKind.Blocked,
                Dir = dir,
                PlayerFrom = from,
                PlayerTo = from
            };

            if (board.GetCell(to) == CellType.Wall) return result;

            if (board.HasBox(to))
            {
                var boxTo = to + delta;
                if (board.GetCell(boxTo) == CellType.Wall || board.HasBox(boxTo))
                    return result;              // đẩy vào tường hoặc vào hộp khác

                result.Kind = MoveKind.Push;
                result.PlayerTo = to;
                result.BoxFrom = to;
                result.BoxTo = boxTo;
                return result;
            }

            result.Kind = MoveKind.Walk;
            result.PlayerTo = to;
            return result;
        }

        public static void Apply(Board board, MoveResult move)
        {
            if (move.IsBlocked) return;

            if (move.IsPush)
            {
                board.Boxes.Remove(move.BoxFrom);
                board.Boxes.Add(move.BoxTo);
            }
            board.PlayerPos = move.PlayerTo;
        }

        public static void Revert(Board board, MoveResult move)
        {
            if (move.IsBlocked) return;

            if (move.IsPush)
            {
                board.Boxes.Remove(move.BoxTo);
                board.Boxes.Add(move.BoxFrom);
            }
            board.PlayerPos = move.PlayerFrom;
        }
    }
}
