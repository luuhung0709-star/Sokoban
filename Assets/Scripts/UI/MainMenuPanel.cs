using Sokoban.Audio;
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
            // Mỗi nút đều là "thao tác đầu tiên" hợp lệ để trình duyệt cho phép phát nhạc.
            continueButton.onClick.AddListener(() => { StartMusic(); flow.ContinueGame(); });
            levelSelectButton.onClick.AddListener(() => { StartMusic(); flow.ShowLevelSelect(); });
            muteButton.onClick.AddListener(() => { StartMusic(); ToggleMute(); });
        }

        static void StartMusic() => AudioService.Instance?.StartMusicOnFirstInteraction();

        void ToggleMute()
        {
            ProgressStore.Muted = !ProgressStore.Muted;
            AudioService.Instance?.SetMuted(ProgressStore.Muted);
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
