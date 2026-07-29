using UnityEngine;

namespace Sokoban.View
{
    /// <summary>Canh camera sao cho cả màn vừa khung, kèm lề, dù màn to hay nhỏ.</summary>
    [RequireComponent(typeof(Camera))]
    public class CameraFitter : MonoBehaviour
    {
        [SerializeField] float margin = 1.5f;
        [SerializeField] float minSize = 4f;

        Camera _camera;

        void Awake() => _camera = GetComponent<Camera>();

        public void Fit(int width, int height)
        {
            if (_camera == null) _camera = GetComponent<Camera>();

            // Bàn cờ trải từ x = 0..width và y = 0..-height, nên tâm nằm ở đây.
            var center = new Vector3(width * 0.5f, -height * 0.5f, transform.position.z);
            transform.position = center;

            float halfHeight = height * 0.5f + margin;
            float halfWidthAsHeight = (width * 0.5f + margin) / Mathf.Max(_camera.aspect, 0.0001f);

            _camera.orthographicSize = Mathf.Max(minSize, halfHeight, halfWidthAsHeight);
        }
    }
}
