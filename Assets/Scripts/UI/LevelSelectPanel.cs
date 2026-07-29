using System.Collections.Generic;
using Sokoban.Levels;
using Sokoban.Progress;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class LevelSelectPanel : MonoBehaviour
    {
        [SerializeField] GameFlowController flow;
        [SerializeField] LevelCollection collection;
        [SerializeField] Transform content;
        [SerializeField] GameObject levelButtonPrefab;
        [SerializeField] Button backButton;
        [SerializeField] TextMeshProUGUI emptyLabel;

        readonly List<GameObject> _buttons = new List<GameObject>();

        void Awake() => backButton.onClick.AddListener(() => flow.ShowMainMenu());

        public void Show()
        {
            gameObject.SetActive(true);
            Rebuild();
        }

        public void Hide() => gameObject.SetActive(false);

        public void Rebuild()
        {
            foreach (var go in _buttons) Destroy(go);
            _buttons.Clear();

            bool empty = collection == null || collection.levels == null || collection.levels.Count == 0;
            emptyLabel.gameObject.SetActive(empty);
            if (empty)
            {
                // Thà báo rõ còn hơn để người chơi nhìn một màn hình trắng.
                emptyLabel.text = "Chưa có màn nào. Chạy menu Sokoban → Import Microban .txt…";
                return;
            }

            for (int i = 0; i < collection.levels.Count; i++)
            {
                int index = i;
                var go = Instantiate(levelButtonPrefab, content);
                _buttons.Add(go);

                var view = go.GetComponent<LevelButtonView>();
                var record = ProgressStore.GetRecord(collection.collectionName, index);
                bool unlocked = ProgressStore.IsUnlocked(collection.collectionName, index);

                view.Bind(index + 1, record.completed, unlocked,
                          record.completed ? record.bestMoves : 0,
                          () => flow.StartLevel(index));
            }
        }
    }
}
