import { boxKey, CellType } from '../core/board.js';
import { toDelta } from '../core/direction.js';
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
  #looping = false;
  #wake = null;         // đánh thức vòng lặp đang chờ quãng nghỉ lặp phím

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
    // Màn có thể bắt đầu với nhân vật đã áp sẵn vào hộp.
    this.#syncPushPose();
  }

  /**
   * Ngắt lượt chơi này. GameFlow gọi khi rời màn: animation đang dở vẫn giữ
   * tham chiếu tới session và renderer cũ, không dừng thì nó chạy tiếp và vẽ
   * đè lên màn vừa mở.
   */
  stop() {
    this.#stopped = true;
    this.#buffered = null;
    this.#wake?.();     // đang ngủ chờ lặp phím thì tỉnh ngay để thoát vòng lặp
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

    // Phải chặn cả khi vòng lặp đang chờ quãng nghỉ lặp phím: lúc đó animation
    // đã xong nên `isBusy` tắt, và nếu chỉ dựa vào nó thì phím bấm mới sẽ khởi
    // động một vòng lặp thứ hai chạy song song, mỗi nước đi thành hai.
    if (this.#animator.isBusy || this.#looping) {
      this.#buffered = command;
      // Vòng lặp có thể đang ngủ chờ quãng nghỉ lặp phím. Đánh thức ngay, không
      // thì gõ phím giữa chừng phải đợi hết quãng nghỉ mới ăn — gõ nhanh sẽ trễ.
      this.#wake?.();
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
    this.#looping = true;
    try {
      while (command && !this.#stopped) {
        const acted = await this.#runOne(command);
        if (this.#stopped) return;

        const next = await this.#nextCommand(acted);
        command = this.#session.isSolved ? null : next;
      }
    } finally {
      this.#looping = false;
    }
  }

  /**
   * Lệnh kế tiếp: lệnh vừa đệm được ưu tiên, sau đó mới tới phím đang giữ — và
   * phím giữ còn phải qua quãng nghỉ lặp mới được tính.
   *
   * Chờ hết quãng nghỉ rồi mới đọc lại, chứ không trả `null` ngay: trả `null` là
   * vòng lặp thoát hẳn, người chơi phải buông phím bấm lại mới đi tiếp được.
   */
  async #nextCommand(acted) {
    const buffered = this.#takeBuffered();
    if (buffered) return buffered;

    // Nước bị chặn thì KHÔNG tự đi tiếp theo phím đang giữ. Người chơi đang ấn
    // vào tường, mà #runOne lúc đó không await gì cả — lặp lại sẽ thành vòng lặp
    // chặt làm treo tab.
    if (!acted) return null;

    const wait = this.#router.msUntilRepeat;
    if (wait == null) return null;              // không giữ phím hướng nào
    if (wait > 0) await this.#sleep(wait);
    if (this.#stopped) return null;

    // Trong lúc chờ người chơi có thể đã buông phím hoặc bấm phím khác.
    return this.#takeBuffered() ?? this.#router.heldDirection;
  }

  #takeBuffered() {
    const command = this.#buffered;
    this.#buffered = null;
    return command;
  }

  /** Ngủ `ms`, nhưng tỉnh sớm khi có lệnh mới hoặc khi lượt chơi bị dừng. */
  #sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.#wake = null;
        resolve();
      }, ms);
      this.#wake = () => {
        clearTimeout(timer);
        this.#wake = null;
        resolve();
      };
    });
  }

  /** Trả về true nếu có gì đó thực sự chạy (và đã chờ animation xong). */
  async #runOne(command) {
    const acted = await this.#dispatch(command);
    // Đồng bộ tư thế ở ĐÚNG MỘT chỗ, sau mọi lệnh — kể cả nước bị chặn, vì nhân
    // vật vẫn quay mặt sang hướng đó và có thể vừa quay vào một cái hộp. Rải lời
    // gọi này ra từng nhánh đi/undo/redo/restart thì sớm muộn cũng sót một nhánh.
    if (!this.#stopped) this.#syncPushPose();
    return acted;
  }

  /** Nhân vật đang áp mặt vào hộp thì chuyển sang tư thế đẩy. */
  #syncPushPose() {
    const board = this.#session.board;
    const { dx, dy } = toDelta(this.#renderer.playerFacing);
    this.#renderer.setPlayerPushing(
      board.boxes.has(boxKey(board.player.x + dx, board.player.y + dy)),
    );
  }

  async #dispatch(command) {
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

  /** Đổi dấu trên hộp ở CUỐI animation, không phải lúc bắt đầu. */
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
