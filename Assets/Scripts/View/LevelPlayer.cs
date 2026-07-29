using System;
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

        // Tạm thời cho Task 7 để scene tự chơi được một mình — Task 10 thay bằng GameFlowController.
        [Header("Tạm thời (Task 10 sẽ thay bằng GameFlowController)")]
        [SerializeField] LevelCollection debugCollection;
        [SerializeField] int debugLevelIndex;

        public GameSession Session { get; private set; }
        public event Action Solved;
        public event Action ExitRequested;

        void Start()
        {
            if (debugCollection != null) LoadLevel(debugCollection, debugLevelIndex);
        }

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

            boardRenderer.Render(Session.Board);
            cameraFitter.Fit(level.width, level.height);
        }

        void OnMoved(Direction dir)
        {
            if (Session == null) return;
            if (!Session.TryMove(dir)) return;

            boardRenderer.Render(Session.Board);      // Task 8 thay bằng tween
            if (Session.IsSolved) Solved?.Invoke();
        }

        // Cả phím tắt lẫn nút trên HUD (Task 11) đều đi qua ba method này — không có đường tắt nào khác.
        public void RequestUndo() => OnUndo();
        public void RequestRedo() => OnRedo();
        public void RequestRestart() => OnRestart();

        void OnUndo()
        {
            if (Session != null && Session.TryUndo()) boardRenderer.Render(Session.Board);
        }

        void OnRedo()
        {
            if (Session != null && Session.TryRedo()) boardRenderer.Render(Session.Board);
        }

        void OnRestart()
        {
            if (Session == null) return;
            Session.Restart();
            boardRenderer.Render(Session.Board);
        }

        void OnExit() => ExitRequested?.Invoke();
    }
}
