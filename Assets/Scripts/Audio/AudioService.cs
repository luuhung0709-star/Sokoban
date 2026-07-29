using UnityEngine;

namespace Sokoban.Audio
{
    public class AudioService : MonoBehaviour
    {
        public static AudioService Instance { get; private set; }

        [SerializeField] AudioSource sfxSource;
        [SerializeField] AudioSource musicSource;
        [SerializeField] AudioClip step;
        [SerializeField] AudioClip push;
        [SerializeField] AudioClip boxOnGoal;
        [SerializeField] AudioClip win;
        [SerializeField] AudioClip undo;

        bool _musicStarted;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        public void PlayStep() => Play(step);
        public void PlayPush() => Play(push);
        public void PlayBoxOnGoal() => Play(boxOnGoal);
        public void PlayWin() => Play(win);
        public void PlayUndo() => Play(undo);

        void Play(AudioClip clip)
        {
            if (clip == null || sfxSource == null) return;
            sfxSource.PlayOneShot(clip);
        }

        public void SetMuted(bool muted)
        {
            AudioListener.volume = muted ? 0f : 1f;
        }

        /// <summary>Trình duyệt chặn audio trước thao tác đầu tiên, nên nhạc chỉ bật từ lần bấm đầu.</summary>
        public void StartMusicOnFirstInteraction()
        {
            if (_musicStarted || musicSource == null || musicSource.clip == null) return;

            _musicStarted = true;
            musicSource.loop = true;
            musicSource.Play();
        }
    }
}
