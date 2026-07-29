using System;
using System.Collections;
using Sokoban.Core;
using UnityEngine;

namespace Sokoban.View
{
    /// <summary>Trượt người chơi và hộp giữa hai ô trong 0.12 giây.</summary>
    public class MoveAnimator : MonoBehaviour
    {
        [SerializeField] BoardRenderer boardRenderer;
        [SerializeField] float duration = 0.12f;

        public bool IsAnimating { get; private set; }

        /// <param name="reversed">true khi undo — người và hộp chạy ngược lại.</param>
        public void Play(MoveResult move, bool reversed, Action onComplete)
        {
            StartCoroutine(PlayRoutine(move, reversed, onComplete));
        }

        IEnumerator PlayRoutine(MoveResult move, bool reversed, Action onComplete)
        {
            IsAnimating = true;

            var playerFrom = BoardRenderer.CellToWorld(reversed ? move.PlayerTo : move.PlayerFrom);
            var playerTo = BoardRenderer.CellToWorld(reversed ? move.PlayerFrom : move.PlayerTo);

            Transform player = boardRenderer.GetPlayerTransform();
            Transform box = null;
            Vector3 boxFrom = default, boxTo = default;

            if (move.IsPush)
            {
                // Người gọi đã chạy MoveBoxRecord TRƯỚC khi gọi Play, nên trong sổ tay hộp
                // đã nằm ở ô đích của lần trượt này — tra theo ô đích, không phải ô xuất phát.
                var boxKey = reversed ? move.BoxFrom : move.BoxTo;
                box = boardRenderer.GetBoxTransform(boxKey);

                boxFrom = BoardRenderer.CellToWorld(reversed ? move.BoxTo : move.BoxFrom);
                boxTo = BoardRenderer.CellToWorld(reversed ? move.BoxFrom : move.BoxTo);
            }

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);

                if (player != null) player.position = Vector3.Lerp(playerFrom, playerTo, t);
                if (box != null) box.position = Vector3.Lerp(boxFrom, boxTo, t);
                yield return null;
            }

            if (player != null) player.position = playerTo;
            if (box != null) box.position = boxTo;

            IsAnimating = false;
            onComplete?.Invoke();
        }
    }
}
