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
 * Giữ phím bao lâu thì mới bắt đầu tự đi tiếp.
 *
 * Không có quãng nghỉ này thì gõ nhẹ một cái cũng ra 2–3 nước (mỗi nước 120ms),
 * và đẩy thùng lố mất một ô. Auto-repeat của hệ điều hành nghỉ ~500ms — đủ để
 * chính xác nhưng cầm phím đi đường dài thì khựng, nên lấy mức ngắn hơn.
 */
const REPEAT_DELAY_MS = 250;

/** Gom bàn phím và nút bấm thành một luồng lệnh duy nhất. */
export class InputRouter {
  #target;
  #listeners = new Set();
  #held = [];           // { command, at } của phím hướng đang giữ, mới nhất ở cuối

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
    return this.#newestHeld()?.dir ?? null;
  }

  /**
   * Còn bao nhiêu mili-giây nữa thì phím đang giữ được phép đi tiếp. Trả `null`
   * khi không giữ phím hướng nào, `0` khi đã qua quãng nghỉ.
   *
   * Tách khỏi `heldDirection` chứ không gộp làm một: người gọi cần phân biệt
   * "không giữ phím" với "có giữ nhưng chưa tới lúc", vì trường hợp sau phải
   * chờ rồi đi tiếp, còn trường hợp đầu là dừng hẳn.
   */
  get msUntilRepeat() {
    const held = this.#newestHeld();
    if (!held) return null;
    return Math.max(0, REPEAT_DELAY_MS - (performance.now() - held.at));
  }

  /** Phím hướng được giữ gần đây nhất — bấm phím mới thì đổi hướng ngay. */
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

    // Chỉ chặn cuộn trang khi đang chơi: ở màn chọn màn, mũi tên phải cuộn được
    // lưới 155 nút.
    if (document.body.dataset.screen === 'play') event.preventDefault();

    if (commandToDirection(command)) {
      if (event.repeat) return;                 // nhịp lặp của OS bỏ qua, đã tự lo
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

  /** Mất focus thì coi như buông hết phím, không thì người chơi sẽ đi mãi. */
  onBlur() {
    this.#held = [];
  }

  #emit(command) {
    for (const listener of this.#listeners) listener(command);
  }
}
