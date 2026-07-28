using System;
using Sokoban.Levels;

namespace Sokoban.Core
{
    /// <summary>Gói board + lịch sử + bộ đếm cho một lượt chơi một màn.</summary>
    public class GameSession
    {
        readonly LevelData _level;
        readonly MoveHistory _history = new MoveHistory();

        public Board Board { get; private set; }
        public int Moves { get; private set; }
        public int Pushes { get; private set; }
        public bool IsSolved => Board.IsSolved;
        public bool CanUndo => _history.CanUndo;
        public bool CanRedo => _history.CanRedo;
        public string LevelName => _level.name;

        /// <summary>Phát mỗi khi board hoặc bộ đếm đổi, để lớp hiển thị bám theo.</summary>
        public event Action Changed;

        public GameSession(LevelData level)
        {
            _level = level;
            // Viết đủ tên kiểu: thuộc tính Board trùng tên với kiểu Board, để trần dễ đọc nhầm.
            Board = Sokoban.Core.Board.FromLevel(level);
        }

        // Bản không có 'out' cho test và cho chỗ không quan tâm chi tiết;
        // bản có 'out' cho lớp hiển thị, vì animation cần biết chính xác nước nào vừa chạy.
        public bool TryMove(Direction dir) => TryMove(dir, out _);
        public bool TryUndo() => TryUndo(out _);
        public bool TryRedo() => TryRedo(out _);

        public bool TryMove(Direction dir, out MoveResult move)
        {
            move = MoveResolver.Resolve(Board, dir);
            if (move.IsBlocked) return false;

            MoveResolver.Apply(Board, move);
            _history.Record(move);
            Moves++;
            if (move.IsPush) Pushes++;

            Changed?.Invoke();
            return true;
        }

        public bool TryUndo(out MoveResult move)
        {
            move = default;
            if (!_history.CanUndo) return false;

            move = _history.PopForUndo();
            MoveResolver.Revert(Board, move);
            Moves--;
            if (move.IsPush) Pushes--;

            Changed?.Invoke();
            return true;
        }

        public bool TryRedo(out MoveResult move)
        {
            move = default;
            if (!_history.CanRedo) return false;

            move = _history.PopForRedo();
            MoveResolver.Apply(Board, move);
            Moves++;
            if (move.IsPush) Pushes++;

            Changed?.Invoke();
            return true;
        }

        public void Restart()
        {
            Board = Sokoban.Core.Board.FromLevel(_level);
            _history.Clear();
            Moves = 0;
            Pushes = 0;
            Changed?.Invoke();
        }
    }
}
