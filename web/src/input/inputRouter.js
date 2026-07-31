import { Direction } from '../core/direction.js';

export const Command = Object.freeze({
  Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right',
  Undo: 'Undo', Redo: 'Redo', Restart: 'Restart', Exit: 'Exit',
});

const KEY_TO_COMMAND = {
  ArrowUp: Command.Up, KeyW: Command.Up,
  ArrowDown: Command.Down, KeyS: Command.Down,
  ArrowLeft: Command.Left, KeyA: Command.Left,
  ArrowRight: Command.Right, KeyD: Command.Right,
  KeyU: Command.Undo,
  KeyY: Command.Redo,
  KeyR: Command.Restart,
  Escape: Command.Exit,
};

const COMMAND_TO_DIRECTION = {
  [Command.Up]: Direction.Up,
  [Command.Down]: Direction.Down,
  [Command.Left]: Direction.Left,
  [Command.Right]: Direction.Right,
};

export function commandToDirection(command) {
  return COMMAND_TO_DIRECTION[command] ?? null;
}

/**
 * How long a key must be held before it starts auto-walking.
 *
 * Without this pause, a light tap yields 2–3 moves (120ms each) and overshoots a box
 * by a square. The OS auto-repeat waits ~500ms — accurate enough, but it stutters on
 * long walks, so this uses a shorter delay.
 */
const REPEAT_DELAY_MS = 250;

/** Merges keyboard and on-screen buttons into a single command stream. */
export class InputRouter {
  #target;
  #listeners = new Set();
  #held = [];           // { command, at } for each held direction key, newest last

  constructor(target = window) {
    this.#target = target;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
  }

  attach() {
    this.#target.addEventListener('keydown', this.onKeyDown);
    this.#target.addEventListener('keyup', this.onKeyUp);
    this.#target.addEventListener('blur', this.onBlur);
  }

  detach() {
    this.#target.removeEventListener('keydown', this.onKeyDown);
    this.#target.removeEventListener('keyup', this.onKeyUp);
    this.#target.removeEventListener('blur', this.onBlur);
  }

  onCommand(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  bindButton(el, command) {
    el.addEventListener('click', () => this.#emit(command));
  }

  /**
   * Direction of the held key, newest wins. LevelPlayer asks for this after every
   * animation instead of relying on the OS auto-repeat — auto-repeat lags about
   * 500ms on the first beat, so holding a key would stutter.
   */
  get heldDirection() {
    return this.#newestHeld()?.dir ?? null;
  }

  /**
   * Milliseconds until the held key is allowed to step again. Returns `null` when no
   * direction key is held, `0` once the delay has passed.
   *
   * Kept separate from `heldDirection` rather than merged: callers must tell "no key
   * held" apart from "held, but not yet due", because the latter means wait and then
   * continue while the former means stop outright.
   */
  get msUntilRepeat() {
    const held = this.#newestHeld();
    if (!held) return null;
    return Math.max(0, REPEAT_DELAY_MS - (performance.now() - held.at));
  }

  /** The most recently held direction key — a new key changes direction at once. */
  #newestHeld() {
    for (let i = this.#held.length - 1; i >= 0; i--) {
      const dir = commandToDirection(this.#held[i].command);
      if (dir) return { dir, at: this.#held[i].at };
    }
    return null;
  }

  onKeyDown(event) {
    const command = KEY_TO_COMMAND[event.code];
    if (!command) return;

    // Only block page scrolling during play: on the level select, the arrows must
    // still scroll the 155-button grid.
    if (document.body.dataset.screen === 'play') event.preventDefault();

    if (commandToDirection(command)) {
      if (event.repeat) return;                 // ignore the OS repeat beat, handled here
      if (!this.#held.some((h) => h.command === command)) {
        this.#held.push({ command, at: performance.now() });
      }
    }
    this.#emit(command);
  }

  onKeyUp(event) {
    const command = KEY_TO_COMMAND[event.code];
    if (!command) return;
    this.#held = this.#held.filter((h) => h.command !== command);
  }

  /** Losing focus counts as releasing every key, or the player would walk forever. */
  onBlur() {
    this.#held = [];
  }

  #emit(command) {
    for (const listener of this.#listeners) listener(command);
  }
}
