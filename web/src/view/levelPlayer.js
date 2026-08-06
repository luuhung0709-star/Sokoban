import { boxKey, CellType } from '../core/board.js';
import { toDelta } from '../core/direction.js';
import { commandToDirection, Command } from '../input/inputRouter.js';

/**
 * The play loop for one level: take a command, call the session, run the animation.
 * While an animation runs it buffers at most 1 command — buffer more and the player
 * keeps walking several steps after the key is released.
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
  #wake = null;         // wakes the loop while it waits out the key-repeat delay

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
    // A level can start with the player already braced against a box.
    this.#syncPushPose();
  }

  /**
   * Cuts this play-through short. GameFlow calls it when leaving a level: an
   * in-flight animation still holds references to the old session and renderer, and
   * left running it would carry on and draw over the level just opened.
   */
  stop() {
    this.#stopped = true;
    this.#buffered = null;
    this.#wake?.();     // if asleep on the repeat delay, wake now to exit the loop
  }

  handle(command) {
    if (this.#stopped) return;

    if (command === Command.Exit) {
      this.#hooks.onExit?.();
      return;
    }

    // Once solved, block every play command: the overlay covers the board, so
    // changing the board behind it is pointless. Retrying or switching levels goes
    // through the overlay's buttons — those run via GameFlow, which rebuilds properly.
    //
    // Restart is the exception, and it takes that same route rather than the play loop:
    // `#restart()` resets the session in place, which would leave the win overlay sitting
    // over a board that has quietly gone back to the start. GameFlow tears the overlay
    // down and rebuilds. Without this the R key is dead here, and since the toolbar has
    // no Restart button any more, that would leave no keyboard way to replay a level.
    if (this.#session.isSolved) {
      if (command === Command.Restart) this.#hooks.onRetry?.();
      return;
    }

    // This must also block while the loop waits out the key-repeat delay: the
    // animation has finished by then so `isBusy` is off, and relying on it alone lets
    // a new key press start a second loop in parallel, doubling every move.
    if (this.#animator.isBusy || this.#looping) {
      this.#buffered = command;
      // The loop may be asleep on the key-repeat delay. Wake it now, or a key pressed
      // mid-wait only lands once the delay expires — fast typing would feel laggy.
      this.#wake?.();
      return;
    }
    this.#loop(command).catch((error) => console.error('LevelPlayer: play loop failed', error));
  }

  /**
   * A loop rather than recursion: hold a key for a minute and the recursive version
   * stacks one more frame per step and never unwinds.
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
   * The next command: a buffered one wins, and only then the held key — and a held
   * key still has to clear the repeat delay before it counts.
   *
   * It waits out the delay and re-reads rather than returning `null` straight away:
   * `null` exits the loop entirely, forcing the player to release and press again.
   */
  async #nextCommand(acted) {
    const buffered = this.#takeBuffered();
    if (buffered) return buffered;

    // A blocked move does NOT auto-continue from the held key. The player is pushing
    // into a wall, and #runOne awaits nothing in that case — repeating would spin a
    // tight loop and freeze the tab.
    if (!acted) return null;

    const wait = this.#router.msUntilRepeat;
    if (wait == null) return null;              // no direction key held
    if (wait > 0) await this.#sleep(wait);
    if (this.#stopped) return null;

    // During the wait the player may have released the key or pressed another.
    return this.#takeBuffered() ?? this.#router.heldDirection;
  }

  #takeBuffered() {
    const command = this.#buffered;
    this.#buffered = null;
    return command;
  }

  /** Sleeps `ms`, but wakes early on a new command or when the play-through stops. */
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

  /** Returns true if something actually ran (and its animation has been awaited). */
  async #runOne(command) {
    const acted = await this.#dispatch(command);
    // Sync the pose in EXACTLY ONE place, after every command — including blocked
    // moves, because the player still turns that way and may have just turned into a
    // box. Scattering this call across the move/undo/restart branches would
    // sooner or later miss one.
    if (!this.#stopped) this.#syncPushPose();
    return acted;
  }

  /** Switch to the push pose when the player is braced against a box. */
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
    if (command === Command.Undo) return this.#stepHistory(this.#session.tryUndo());
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
    // Leaving the level mid-animation stops right here: #afterMove would call
    // onSolved on a discarded session, and the level just solved would never be
    // recorded as complete.
    if (this.#stopped) return false;

    this.#afterMove(move);
    return true;
  }

  async #stepHistory(move) {
    if (!move) return false;

    this.#hooks.onSound?.('undo');
    await this.#animator.play(move, { reverse: true });
    // The renderer may have been rebuilt for a different level during the wait.
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

  /** Change the mark on a box at the END of the animation, not at its start. */
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
