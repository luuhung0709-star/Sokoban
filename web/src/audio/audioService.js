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

  /**
   * The single gate on starting the loop: the player must want it (`musicOn`), the
   * page must have been interacted with (`#unlocked`), and the system must not have
   * paused it for an away player (`#suspended`). Every call site funnels through here
   * so that invariant cannot be forgotten by a future one.
   */
  #startMusic() {
    if (this.musicOn && this.#unlocked && !this.#suspended) void this.#music.play().catch(() => {});
  }

  get musicOn() { return this.#progress.musicOn; }

  set musicOn(value) {
    this.#progress.musicOn = value;
    if (value) {
      // This only records the choice and lets #startMusic() decide whether anything
      // starts right now. If either of its other two guards is still closed, it won't:
      // before the first interaction, unlock() is what starts the loop once one happens;
      // while the player is away (#suspended), resume() is what starts it once they
      // return. Only when neither guard is holding it back does this call start it itself.
      this.#startMusic();
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
    this.#startMusic();
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
   * `#suspended` must be cleared before `#startMusic()` is called, or its guard would
   * block the very resume this method exists to allow.
   */
  resume() {
    if (!this.#suspended) return;
    this.#suspended = false;
    this.#startMusic();
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
