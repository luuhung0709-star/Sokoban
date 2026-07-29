using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Sokoban.UI
{
    public class LevelButtonView : MonoBehaviour
    {
        [SerializeField] Button button;
        [SerializeField] TextMeshProUGUI numberLabel;
        [SerializeField] TextMeshProUGUI bestLabel;
        [SerializeField] GameObject tick;
        [SerializeField] CanvasGroup canvasGroup;

        public void Bind(int displayNumber, bool completed, bool unlocked, int bestMoves, Action onClick)
        {
            numberLabel.text = displayNumber.ToString();
            tick.SetActive(completed);
            bestLabel.text = completed ? $"{bestMoves} bước" : "";

            button.interactable = unlocked;
            canvasGroup.alpha = unlocked ? 1f : 0.35f;

            button.onClick.RemoveAllListeners();
            if (unlocked) button.onClick.AddListener(() => onClick());
        }
    }
}
