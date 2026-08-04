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
  #suspended = false;

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

  get musicOn() { return this.#progress.musicOn; }

  set musicOn(value) {
    this.#progress.musicOn = value;
    if (value) {
      // Nothing may play before the first interaction, so a switch flipped earlier than
      // that just records the choice; unlock() starts the loop when the time comes.
      if (this.#unlocked) void this.#music.play().catch(() => {});
    } else {
      this.#music.pause();
    }
  }

  get sfxOn() { return this.#progress.sfxOn; }

  set sfxOn(value) {
    this.#progress.sfxOn = value;
  }

  unlock() {
    if (this.#unlocked) return;
    this.#unlocked = true;
    if (this.musicOn) void this.#music.play().catch(() => {});
  }

  /**
   * Pauses the music while the player is away. This is the system's doing, not the
   * player's, so it deliberately leaves `progress.musicOn` alone: writing to it would
   * flip the Settings switch to off and turn one alt-tab into a permanent mute.
   */
  suspend() {
    if (this.#suspended) return;
    this.#suspended = true;
    this.#music.pause();
  }

  /**
   * All three conditions earn their place. `#suspended` stops a stray focus event
   * starting music that nobody paused; `musicOn` stops it overriding the player's own
   * switch; `#unlocked` keeps the autoplay rule above intact.
   */
  resume() {
    if (!this.#suspended) return;
    this.#suspended = false;
    if (this.musicOn && this.#unlocked) void this.#music.play().catch(() => {});
  }

  play(name) {
    if (!this.sfxOn) return;

    const source = this.#buffers.get(name);
    if (!source) return;

    // Clone so two sounds can overlap: sharing one node means fast key presses cut
    // the previous sound off mid-play.
    const clip = source.cloneNode();
    clip.volume = 0.7;
    void clip.play().catch(() => {});
  }
}
