const AUDIO = 'assets/audio';

const SFX = {
  step: `${AUDIO}/step.ogg`,
  push: `${AUDIO}/push.ogg`,
  boxOnGoal: `${AUDIO}/box_on_goal.ogg`,
  win: `${AUDIO}/win.ogg`,
  undo: `${AUDIO}/undo.ogg`,
};

/**
 * SFX và nhạc nền. Trình duyệt chặn autoplay trước thao tác đầu tiên của người
 * dùng, nên nhạc nền chỉ bắt đầu khi unlock() được gọi từ trong một sự kiện
 * chuột hoặc bàn phím.
 */
export class AudioService {
  #progress;
  #buffers = new Map();
  #music;
  #unlocked = false;

  constructor(progress) {
    this.#progress = progress;

    for (const [name, src] of Object.entries(SFX)) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      this.#buffers.set(name, audio);
    }

    this.#music = new Audio(`${AUDIO}/music_loop.mp3`);
    this.#music.loop = true;
    this.#music.volume = 0.35;
  }

  get muted() { return this.#progress.muted; }

  set muted(value) {
    this.#progress.muted = value;
    if (value) this.#music.pause();
    else if (this.#unlocked) void this.#music.play().catch(() => {});
  }

  unlock() {
    if (this.#unlocked) return;
    this.#unlocked = true;
    if (!this.muted) void this.#music.play().catch(() => {});
  }

  play(name) {
    if (this.muted) return;

    const source = this.#buffers.get(name);
    if (!source) return;

    // Clone để hai tiếng chồng nhau được: bấm phím nhanh mà dùng chung một node
    // thì tiếng trước bị cắt ngang.
    const clip = source.cloneNode();
    clip.volume = 0.7;
    void clip.play().catch(() => {});
  }
}
