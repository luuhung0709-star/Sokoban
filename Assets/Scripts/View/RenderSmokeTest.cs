using Sokoban.Core;
using Sokoban.Levels;
using UnityEngine;

namespace Sokoban.View
{
    /// <summary>Tạm thời: vẽ một màn ngay khi Play để mắt thường kiểm chứng. Xoá ở Task 7.</summary>
    public class RenderSmokeTest : MonoBehaviour
    {
        [SerializeField] LevelCollection collection;
        [SerializeField] int levelIndex;
        [SerializeField] BoardRenderer boardRenderer;
        [SerializeField] CameraFitter cameraFitter;

        void Start()
        {
            var level = collection.levels[levelIndex];
            var board = Board.FromLevel(level);

            boardRenderer.Render(board);
            cameraFitter.Fit(level.width, level.height);
        }
    }
}
