using System.Collections.Generic;

namespace Sokoban.Core
{
    /// <summary>Hai stack: nước đã đi và nhánh đã undo. Đi nước mới thì xoá nhánh redo.</summary>
    public class MoveHistory
    {
        readonly List<MoveResult> _done = new List<MoveResult>();
        readonly List<MoveResult> _undone = new List<MoveResult>();

        public bool CanUndo => _done.Count > 0;
        public bool CanRedo => _undone.Count > 0;

        public void Record(MoveResult move)
        {
            _done.Add(move);
            _undone.Clear();
        }

        public MoveResult PopForUndo()
        {
            var move = _done[_done.Count - 1];
            _done.RemoveAt(_done.Count - 1);
            _undone.Add(move);
            return move;
        }

        public MoveResult PopForRedo()
        {
            var move = _undone[_undone.Count - 1];
            _undone.RemoveAt(_undone.Count - 1);
            _done.Add(move);
            return move;
        }

        public void Clear()
        {
            _done.Clear();
            _undone.Clear();
        }
    }
}
