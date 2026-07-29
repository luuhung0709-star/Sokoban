using System;
using Sokoban.Core;
using UnityEngine;

namespace Sokoban.InputSystem
{
    /// <summary>Gom bàn phím và vuốt thành một luồng lệnh duy nhất.</summary>
    public class InputRouter : MonoBehaviour
    {
        [SerializeField] float swipeThreshold = 40f;   // pixel

        public event Action<Direction> Moved;
        public event Action UndoPressed;
        public event Action RedoPressed;
        public event Action RestartPressed;
        public event Action ExitPressed;

        Vector2 _touchStart;
        bool _tracking;

        void Update()
        {
            ReadKeyboard();
            ReadSwipe();
        }

        void ReadKeyboard()
        {
            if (Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W)) Moved?.Invoke(Direction.Up);
            if (Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S)) Moved?.Invoke(Direction.Down);
            if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) Moved?.Invoke(Direction.Left);
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) Moved?.Invoke(Direction.Right);

            if (Input.GetKeyDown(KeyCode.U)) UndoPressed?.Invoke();
            if (Input.GetKeyDown(KeyCode.Y)) RedoPressed?.Invoke();
            if (Input.GetKeyDown(KeyCode.R)) RestartPressed?.Invoke();
            if (Input.GetKeyDown(KeyCode.Escape)) ExitPressed?.Invoke();
        }

        void ReadSwipe()
        {
            if (Input.touchCount > 0)
            {
                var touch = Input.GetTouch(0);
                if (touch.phase == TouchPhase.Began) { _touchStart = touch.position; _tracking = true; }
                else if (touch.phase == TouchPhase.Ended && _tracking)
                {
                    _tracking = false;
                    EmitSwipe(touch.position - _touchStart);
                }
                return;
            }

            // Chuột kéo cũng tính là vuốt, để thử nhanh trên desktop.
            if (Input.GetMouseButtonDown(0)) { _touchStart = Input.mousePosition; _tracking = true; }
            else if (Input.GetMouseButtonUp(0) && _tracking)
            {
                _tracking = false;
                EmitSwipe((Vector2)Input.mousePosition - _touchStart);
            }
        }

        void EmitSwipe(Vector2 delta)
        {
            if (delta.magnitude < swipeThreshold) return;   // chạm nhẹ, không phải vuốt

            // Trục nào dài hơn thì thắng.
            if (Mathf.Abs(delta.x) > Mathf.Abs(delta.y))
                Moved?.Invoke(delta.x > 0 ? Direction.Right : Direction.Left);
            else
                Moved?.Invoke(delta.y > 0 ? Direction.Up : Direction.Down);   // màn hình y hướng lên
        }
    }
}
