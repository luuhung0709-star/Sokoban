using System;
using Sokoban.Audio;
using Sokoban.Core;
using Sokoban.InputSystem;
using Sokoban.Levels;
using UnityEngine;

namespace Sokoban.View
{
    /// <summary>Nối input với GameSession và cập nhật hiển thị.</summary>
    public class LevelPlayer : MonoBehaviour
    {
        [SerializeField] BoardRenderer boardRenderer;
        [SerializeField] CameraFitter cameraFitter;
        [SerializeField] InputRouter input;
        [SerializeField] MoveAnimator animator;

        public GameSession Session { get; private set; }
        public event Action Solved;
        public event Action ExitRequested;

        void OnEnable()
        {
            input.Moved += OnMoved;
            input.UndoPressed += OnUndo;
            input.RedoPressed += OnRedo;
            input.RestartPressed += OnRestart;
            input.ExitPressed += OnExit;
        }

        void OnDisable()
        {
            input.Moved -= OnMoved;
            input.UndoPressed -= OnUndo;
            input.RedoPressed -= OnRedo;
            input.RestartPressed -= OnRestart;
            input.ExitPressed -= OnExit;
        }

        public void LoadLevel(LevelCollection collection, int index)
        {
            var level = collection.levels[index];
            Session = new GameSession(level);

            _buffered = null;   // nước còn treo từ màn trước không được chạy lên bàn cờ mới

            boardRenderer.Render(Session.Board);
            cameraFitter.Fit(level.width, level.height);
        }

        Direction? _buffered;

        void DrainBuffer()
        {
            if (_buffered == null) return;

            var next = _buffered.Value;
            _buffered = null;
            OnMoved(next);
        }

        void OnMoved(Direction dir)
        {
            if (Session == null) return;

            if (animator.IsAnimating)
            {
                _buffered = dir;      // chỉ giữ nước mới nhất, đúng "đệm tối đa 1 nước"
                return;
            }

            if (!Session.TryMove(dir, out var move)) return;
            if (move.IsPush) boardRenderer.MoveBoxRecord(move.BoxFrom, move.BoxTo);

            boardRenderer.SetPlayerFacing(dir);   // quay mặt ngay, không đợi trượt xong

            var audio = AudioService.Instance;
            if (audio != null)
            {
                if (move.IsPush) audio.PlayPush();
                else audio.PlayStep();
            }

            animator.Play(move, reversed: false, onComplete: () =>
            {
                if (move.IsPush)
                    boardRenderer.SetBoxSprite(move.BoxTo,
                        Session.Board.GetCell(move.BoxTo) == CellType.Goal);

                if (move.IsPush && Session.Board.GetCell(move.BoxTo) == CellType.Goal)
                    AudioService.Instance?.PlayBoxOnGoal();

                if (Session.IsSolved)
                {
                    AudioService.Instance?.PlayWin();
                    Solved?.Invoke();
                }
                DrainBuffer();
            });
        }

        // Cả phím tắt lẫn nút trên HUD (Task 11) đều đi qua ba method này — không có đường tắt nào khác.
        public void RequestUndo() => OnUndo();
        public void RequestRedo() => OnRedo();
        public void RequestRestart() => OnRestart();

        void OnUndo()
        {
            if (Session == null || animator.IsAnimating) return;
            if (!Session.TryUndo(out var move)) return;

            AudioService.Instance?.PlayUndo();

            // Người lùi về ô cũ, tức là đi theo hướng ngược với nước vừa huỷ.
            boardRenderer.SetPlayerFacing(move.Dir.Opposite());

            // Undo kéo hộp từ ô đích cũ về ô xuất phát.
            if (move.IsPush) boardRenderer.MoveBoxRecord(move.BoxTo, move.BoxFrom);

            animator.Play(move, reversed: true, onComplete: () =>
            {
                if (move.IsPush)
                    boardRenderer.SetBoxSprite(move.BoxFrom,
                        Session.Board.GetCell(move.BoxFrom) == CellType.Goal);
            });
        }

        void OnRedo()
        {
            if (Session == null || animator.IsAnimating) return;
            if (!Session.TryRedo(out var move)) return;

            AudioService.Instance?.PlayUndo();

            boardRenderer.SetPlayerFacing(move.Dir);

            if (move.IsPush) boardRenderer.MoveBoxRecord(move.BoxFrom, move.BoxTo);

            animator.Play(move, reversed: false, onComplete: () =>
            {
                if (move.IsPush)
                    boardRenderer.SetBoxSprite(move.BoxTo,
                        Session.Board.GetCell(move.BoxTo) == CellType.Goal);

                if (Session.IsSolved)
                {
                    AudioService.Instance?.PlayWin();
                    Solved?.Invoke();
                }
            });
        }

        void OnRestart()
        {
            if (Session == null) return;

            _buffered = null;                    // bỏ nước đang chờ, nếu không nó sẽ chạy lên bàn cờ mới
            Session.Restart();
            boardRenderer.Render(Session.Board); // vẽ lại toàn bộ, không tween
        }

        void OnExit() => ExitRequested?.Invoke();
    }
}
