using System;
using Sokoban.Core;
using UnityEngine;
using UnityEngine.EventSystems;

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
        bool _trackingIsTouch;   // gesture hiện tại bắt đầu từ chạm hay từ chuột

        void Update()
        {
            ReadKeyboard();
            ReadSwipe();
        }

        void ReadKeyboard()
        {
            // else-if: mỗi khung hình chỉ phát tối đa một hướng, kể cả khi hai phím trùng khung hình.
            if (Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W)) Moved?.Invoke(Direction.Up);
            else if (Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S)) Moved?.Invoke(Direction.Down);
            else if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) Moved?.Invoke(Direction.Left);
            else if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) Moved?.Invoke(Direction.Right);

            // Lệnh riêng, độc lập với hướng đi và với nhau — được phép trùng khung hình.
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
                if (touch.phase == TouchPhase.Began)
                {
                    if (IsOverUI(touch.fingerId)) return;   // vuốt bắt đầu trên nút HUD là để bấm nút, không phải để đi

                    _touchStart = touch.position;
                    _tracking = true;
                    _trackingIsTouch = true;
                }
                else if (touch.phase == TouchPhase.Ended && _tracking)
                {
                    _tracking = false;
                    EmitSwipe(touch.position - _touchStart);
                }
                else if (touch.phase == TouchPhase.Canceled && _tracking)
                {
                    _tracking = false;   // vuốt bị huỷ giữa chừng (hệ thống thu hồi con trỏ) — không đoán hướng
                }
                return;
            }

            if (_tracking && _trackingIsTouch)
            {
                // Chạm biến mất mà không có Ended/Canceled (mất focus, app bị thu hồi con trỏ) —
                // huỷ luôn, không để _touchStart cũ lọt sang nhánh chuột bên dưới và phát vuốt ma.
                _tracking = false;
                return;
            }

            // Chuột kéo cũng tính là vuốt, để thử nhanh trên desktop.
            if (Input.GetMouseButtonDown(0))
            {
                if (IsOverUI(-1)) return;

                _touchStart = Input.mousePosition;
                _tracking = true;
                _trackingIsTouch = false;
            }
            else if (Input.GetMouseButtonUp(0) && _tracking)
            {
                _tracking = false;
                EmitSwipe((Vector2)Input.mousePosition - _touchStart);
            }
        }

        /// <summary>Con trỏ đang nằm trên UI hay không. fingerId &lt; 0 nghĩa là chuột.</summary>
        static bool IsOverUI(int fingerId)
        {
            var events = EventSystem.current;
            if (events == null) return false;
            return fingerId >= 0 ? events.IsPointerOverGameObject(fingerId) : events.IsPointerOverGameObject();
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
