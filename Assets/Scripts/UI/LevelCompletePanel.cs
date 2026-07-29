using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class LevelCompletePanel : MonoBehaviour
    {
        [SerializeField] GameFlowController flow;
        [SerializeField] TextMeshProUGUI titleLabel;
        [SerializeField] TextMeshProUGUI movesLabel;
        [SerializeField] TextMeshProUGUI bestLabel;
        [SerializeField] Button nextButton;
        [SerializeField] Button replayButton;
        [SerializeField] Button selectButton;

        void Awake()
        {
            nextButton.onClick.AddListener(() => flow.NextLevel());
            replayButton.onClick.AddListener(() => flow.ReplayLevel());
            selectButton.onClick.AddListener(() => flow.ShowLevelSelect());
        }

        public void Show(int moves, int previousBest, bool isLastLevel)
        {
            gameObject.SetActive(true);

            titleLabel.text = isLastLevel ? "Xong cả bộ màn!" : "Hoàn thành!";
            movesLabel.text = $"{moves} bước";
            bestLabel.text = previousBest > 0 ? $"Kỷ lục cũ: {previousBest} bước" : "Kỷ lục đầu tiên";

            // Ở màn cuối không còn màn nào để đi tiếp.
            nextButton.gameObject.SetActive(!isLastLevel);
        }

        public void Hide() => gameObject.SetActive(false);
    }
}
