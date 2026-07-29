using Sokoban.Levels;
using Sokoban.Progress;
using Sokoban.View;
using UnityEngine;

namespace Sokoban.UI
{
    /// <summary>Bật/tắt các panel và quyết định đang ở màn hình nào.</summary>
    public class GameFlowController : MonoBehaviour
    {
        [SerializeField] LevelCollection collection;
        [SerializeField] LevelPlayer levelPlayer;
        [SerializeField] MainMenuPanel mainMenu;
        [SerializeField] LevelSelectPanel levelSelect;
        [SerializeField] GameObject boardRoot;

        int _currentIndex;

        void Start()
        {
            levelPlayer.Solved += OnSolved;
            levelPlayer.ExitRequested += ShowLevelSelect;
            ShowMainMenu();
        }

        public void ShowMainMenu()
        {
            mainMenu.Show();
            levelSelect.Hide();
            boardRoot.SetActive(false);
        }

        public void ShowLevelSelect()
        {
            mainMenu.Hide();
            levelSelect.Show();
            boardRoot.SetActive(false);
        }

        public void ContinueGame() => StartLevel(ProgressStore.GetLastPlayedIndex(collection.collectionName));

        public void StartLevel(int index)
        {
            if (collection.levels.Count == 0) { ShowLevelSelect(); return; }

            _currentIndex = Mathf.Clamp(index, 0, collection.levels.Count - 1);
            ProgressStore.SetLastPlayedIndex(collection.collectionName, _currentIndex);

            mainMenu.Hide();
            levelSelect.Hide();
            boardRoot.SetActive(true);

            levelPlayer.LoadLevel(collection, _currentIndex);
        }

        void OnSolved()
        {
            var session = levelPlayer.Session;

            ProgressStore.RecordCompletion(collection.collectionName, _currentIndex,
                                           session.Moves, session.Pushes);

            // Task 11 thay dòng này bằng panel thắng màn.
            Debug.Log($"Xong màn {_currentIndex + 1} trong {session.Moves} bước");
            ShowLevelSelect();
        }

        public void NextLevel() => StartLevel(_currentIndex + 1);
        public void ReplayLevel() => StartLevel(_currentIndex);
    }
}
