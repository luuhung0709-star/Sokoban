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
        [SerializeField] HudPanel hud;
        [SerializeField] LevelCompletePanel levelComplete;
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
            hud.Hide();
            levelComplete.Hide();
            boardRoot.SetActive(false);
        }

        public void ShowLevelSelect()
        {
            mainMenu.Hide();
            levelSelect.Show();
            hud.Hide();
            levelComplete.Hide();
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

            levelComplete.Hide();
            hud.Show();
            hud.Bind(levelPlayer.Session);
        }

        void OnSolved()
        {
            var session = levelPlayer.Session;

            // Đọc kỷ lục cũ TRƯỚC khi ghi kết quả lượt này, nếu không sẽ luôn hiện kỷ lục vừa lập.
            var previous = ProgressStore.GetRecord(collection.collectionName, _currentIndex);
            int oldBest = previous.completed ? previous.bestMoves : 0;

            ProgressStore.RecordCompletion(collection.collectionName, _currentIndex,
                                           session.Moves, session.Pushes);

            bool isLast = _currentIndex >= collection.levels.Count - 1;
            levelComplete.Show(session.Moves, oldBest, isLast);
        }

        public void NextLevel() => StartLevel(_currentIndex + 1);
        public void ReplayLevel() => StartLevel(_currentIndex);
    }
}
