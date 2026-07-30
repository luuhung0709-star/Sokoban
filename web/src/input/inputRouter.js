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

/** Gom bàn phím và nút bấm thành một luồng lệnh duy nhất. */
export class InputRouter {
  #target;
  #listeners = new Set();
  #held = [];           // các phím hướng đang giữ, mới nhất ở cuối

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
   * Hướng của phím đang giữ, mới nhất thắng. LevelPlayer hỏi cái này sau mỗi
   * animation thay vì dựa vào auto-repeat của hệ điều hành — auto-repeat trễ
   * khoảng 500ms ở nhịp đầu nên cầm phím sẽ khựng.
   */
  get heldDirection() {
    for (let i = this.#held.length - 1; i >= 0; i--) {
      const dir = commandToDirection(this.#held[i]);
      if (dir) return dir;
    }
    return null;
  }

  onKeyDown(event) {
    const command = KEY_TO_COMMAND[event.code];
    if (!command) return;

    event.preventDefault();   // mũi tên không được cuộn trang

    if (commandToDirection(command)) {
      if (event.repeat) return;                 // nhịp lặp của OS bỏ qua, đã tự lo
      if (!this.#held.includes(command)) this.#held.push(command);
    }
    this.#emit(command);
  }

  onKeyUp(event) {
    const command = KEY_TO_COMMAND[event.code];
    if (!command) return;
    this.#held = this.#held.filter((c) => c !== command);
  }

  /** Mất focus thì coi như buông hết phím, không thì người chơi sẽ đi mãi. */
  onBlur() {
    this.#held = [];
  }

  #emit(command) {
    for (const listener of this.#listeners) listener(command);
  }
}
