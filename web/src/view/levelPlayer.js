import { CellType } from '../core/board.js';
import { commandToDirection, Command } from '../input/inputRouter.js';

/**
 * Vòng lặp chơi một màn: nhận lệnh, gọi session, chạy animation. Trong lúc
 * animation chạy thì đệm tối đa 1 lệnh — đệm nhiều hơn thì thả phím ra rồi
 * nhân vật vẫn đi thêm mấy bước.
 */
export class LevelPlayer {
  #session;
  #renderer;
  #animator;
  #router;
  #hooks;
  #buffered = null;
  #stopped = false;

  constructor({ session, renderer, animator, router, hooks = {} }) {
    this.#session = session;
    this.#renderer = renderer;
    this.#animator = animator;
    this.#router = router;
    this.#hooks = hooks;
  }

  start() {
    this.#animator.snap(this.#session.board, () => {
      this.#renderer.fitCellSize(this.#session.board);
    });
  }

  /**
   * Ngắt lượt chơi này. GameFlow gọi khi rời màn: animation đang dở vẫn giữ
   * tham chiếu tới session và renderer cũ, không dừng thì nó chạy tiếp và vẽ
   * đè lên màn vừa mở.
   */
  stop() {
    this.#stopped = true;
    this.#buffered = null;
  }

  handle(command) {
    if (this.#stopped) return;

    if (command === Command.Exit) {
      this.#hooks.onExit?.();
      return;
    }

    // Thắng rồi thì chặn mọi lệnh chơi: overlay đang che bàn cờ nên đổi bàn cờ
    // sau lưng nó là vô nghĩa. Muốn chơi lại hay đổi màn thì dùng nút trên
    // overlay — chúng đi qua GameFlow nên dựng lại màn tử tế.
    if (this.#session.isSolved) return;

    if (this.#animator.isBusy) {
      this.#buffered = command;
      return;
    }
    this.#loop(command).catch((error) => console.error('LevelPlayer: vòng lặp chơi lỗi', error));
  }

  /**
   * Vòng lặp thay vì đệ quy: giữ phím cả phút thì bản đệ quy chồng thêm một
   * khung stack mỗi bước và không bao giờ nhả ra.
   */
  async #loop(first) {
    let command = first;

    while (command && !this.#stopped) {
      const acted = await this.#runOne(command);
      if (this.#stopped) return;

      const buffered = this.#buffered;
      this.#buffered = null;

      // Nước bị chặn thì KHÔNG tự đi tiếp theo phím đang giữ. Người chơi đang
      // ấn vào tường, mà #runOne lúc đó không await gì cả — lặp lại sẽ thành
      // vòng lặp chặt làm treo tab.
      const next = buffered ?? (acted ? this.#router.heldDirection : null);
      command = this.#session.isSolved ? null : next;
    }
  }

  /** Trả về true nếu có gì đó thực sự chạy (và đã chờ animation xong). */
  async #runOne(command) {
    if (this.#stopped) return false;

    const dir = commandToDirection(command);

    if (dir) return this.#step(dir);
    if (command === Command.Undo) return this.#stepHistory(this.#session.tryUndo(), true);
    if (command === Command.Redo) return this.#stepHistory(this.#session.tryRedo(), false);
    if (command === Command.Restart) {
      this.#restart();
      return true;
    }
    return false;
  }

  async #step(dir) {
    this.#renderer.setPlayerFacing(dir);
    const move = this.#session.tryMove(dir);
    if (!move) return false;

    this.#hooks.onSound?.(move.push ? 'push' : 'step');
    await this.#animator.play(move);
    // Rời màn giữa lúc animation chạy thì dừng hẳn ở đây: #afterMove sẽ gọi
    // onSolved trên session đã bị huỷ, và màn vừa giải xong sẽ không được ghi
    // là hoàn thành.
    if (this.#stopped) return false;

    this.#afterMove(move);
    return true;
  }

  async #stepHistory(move, reverse) {
    if (!move) return false;

    this.#hooks.onSound?.('undo');
    await this.#animator.play(move, { reverse });
    // Renderer có thể đã dựng lại cho màn khác trong lúc chờ.
    if (this.#stopped) return false;

    this.#renderer.refreshBoxLook(this.#session.board);
    return true;
  }

  #restart() {
    this.#session.restart();
    this.#animator.snap(this.#session.board, () => {
      this.#renderer.fitCellSize(this.#session.board);
    });
  }

  /** Đổi sprite hộp ở CUỐI animation, không phải lúc bắt đầu. */
  #afterMove(move) {
    this.#renderer.refreshBoxLook(this.#session.board);

    const landedOnGoal = move.push
      && this.#session.board.cellAt(move.boxTo.x, move.boxTo.y) === CellType.Goal;
    if (landedOnGoal) this.#hooks.onSound?.('boxOnGoal');

    if (this.#session.isSolved) {
      this.#hooks.onSound?.('win');
      this.#hooks.onSolved?.();
    }
  }
}
