const AUDIO = 'assets/audio';

const SFX = {
  step: `${AUDIO}/step.ogg`,
  push: `${AUDIO}/push.ogg`,
  boxOnGoal: `${AUDIO}/box_on_goal.ogg`,
  win: `${AUDIO}/win.ogg`,
  undo: `${AUDIO}/undo.ogg`,
};

/**
 * SFX and background music. Browsers block autoplay before the user's first
 * interaction, so the music only starts once unlock() is called from inside a
 * mouse or keyboard event.
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

    // Clone so two sounds can overlap: sharing one node means fast key presses cut
    // the previous sound off mid-play.
    const clip = source.cloneNode();
    clip.volume = 0.7;
    void clip.play().catch(() => {});
  }
}
