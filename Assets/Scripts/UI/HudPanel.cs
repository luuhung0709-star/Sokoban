using Sokoban.Core;
using Sokoban.View;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class HudPanel : MonoBehaviour
    {
        [SerializeField] GameFlowController flow;
        [SerializeField] LevelPlayer levelPlayer;
        [SerializeField] TextMeshProUGUI levelNameLabel;
        [SerializeField] TextMeshProUGUI movesLabel;
        [SerializeField] TextMeshProUGUI pushesLabel;
        [SerializeField] Button undoButton;
        [SerializeField] Button redoButton;
        [SerializeField] Button restartButton;
        [SerializeField] Button exitButton;

        GameSession _session;

        void Awake()
        {
            // Phải đi qua LevelPlayer, không gọi thẳng _session.TryUndo():
            // gọi thẳng sẽ đổi trạng thái logic mà bỏ qua animation và sổ tay vị trí hộp.
            undoButton.onClick.AddListener(() => levelPlayer.RequestUndo());
            redoButton.onClick.AddListener(() => levelPlayer.RequestRedo());
            restartButton.onClick.AddListener(() => levelPlayer.RequestRestart());
            exitButton.onClick.AddListener(() => flow.ShowLevelSelect());
        }

        public void Bind(GameSession session)
        {
            if (_session != null) _session.Changed -= Refresh;

            _session = session;
            if (_session != null) _session.Changed += Refresh;

            Refresh();
        }

        void Refresh()
        {
            if (_session == null) return;

            levelNameLabel.text = $"Màn {_session.LevelName}";
            movesLabel.text = $"Bước: {_session.Moves}";
            pushesLabel.text = $"Đẩy: {_session.Pushes}";
            undoButton.interactable = _session.CanUndo;
            redoButton.interactable = _session.CanRedo;
        }

        public void Show() => gameObject.SetActive(true);

        public void Hide()
        {
            if (_session != null) _session.Changed -= Refresh;
            gameObject.SetActive(false);
        }
    }
}
