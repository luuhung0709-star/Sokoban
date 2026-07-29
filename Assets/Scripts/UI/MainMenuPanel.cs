using Sokoban.Progress;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class MainMenuPanel : MonoBehaviour
    {
        [SerializeField] GameFlowController flow;
        [SerializeField] Button continueButton;
        [SerializeField] Button levelSelectButton;
        [SerializeField] Button muteButton;
        [SerializeField] TextMeshProUGUI muteLabel;

        void Awake()
        {
            continueButton.onClick.AddListener(() => flow.ContinueGame());
            levelSelectButton.onClick.AddListener(() => flow.ShowLevelSelect());
            muteButton.onClick.AddListener(ToggleMute);
        }

        void ToggleMute()
        {
            ProgressStore.Muted = !ProgressStore.Muted;
            RefreshMuteLabel();
        }

        void RefreshMuteLabel() =>
            muteLabel.text = ProgressStore.Muted ? "Bật tiếng" : "Tắt tiếng";

        public void Show()
        {
            gameObject.SetActive(true);
            RefreshMuteLabel();
        }

        public void Hide() => gameObject.SetActive(false);
    }
}
