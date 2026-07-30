import { GameSession } from '../core/gameSession.js';
import { LevelPlayer } from '../view/levelPlayer.js';

/** Giữ màn hình hiện tại và điều phối các panel. */
export class GameFlow {
  #collection;
  #progress;
  #router;
  #renderer;
  #animator;
  #hud;
  #panels;
  #audio;

  #session = null;
  #player = null;
  #index = 0;
  #unbindHud = null;
  #unroute = null;

  constructor({ collection, progress, router, renderer, animator, hud, panels, audio }) {
    this.#collection = collection;
    this.#progress = progress;
    this.#router = router;
    this.#renderer = renderer;
    this.#animator = animator;
    this.#hud = hud;
    this.#panels = panels;
    this.#audio = audio;
  }

  get #collectionName() { return this.#collection.collectionName; }

  start() {
    this.#router.attach();
    this.showMenu();
  }

  showMenu() {
    this.#leaveLevel();
    this.#panels.menu.refresh(this.#progress, this.#collectionName, this.#collection.levels);
    document.body.dataset.screen = 'menu';
  }

  showLevelSelect() {
    this.#leaveLevel();
    this.#panels.levelSelect.render(this.#collection.levels, this.#progress, this.#collectionName);
    document.body.dataset.screen = 'levels';
  }

  playLevel(index) {
    this.#leaveLevel();

    const level = this.#collection.levels[index];
    if (!level) return;

    this.#index = index;
    this.#progress.setLastPlayedIndex(this.#collectionName, index);
    this.#panels.levelComplete.hide();

    this.#session = new GameSession(level);
    this.#player = new LevelPlayer({
      session: this.#session,
      renderer: this.#renderer,
      animator: this.#animator,
      router: this.#router,
      hooks: {
        onExit: () => this.showLevelSelect(),
        onSolved: () => this.#onSolved(),
        onSound: (name) => this.#audio.play(name),
      },
    });

    this.#hud.setLevelLabel(`Màn ${level.name}`);
    this.#unbindHud = this.#hud.bind(this.#session);
    this.#unroute = this.#router.onCommand((command) => this.#player.handle(command));

    document.body.dataset.screen = 'play';
    this.#player.start();
  }

  /** Đổi kích thước cửa sổ: tính lại cỡ ô cho màn đang chơi. */
  handleResize() {
    if (this.#session) this.#renderer.fitCellSize(this.#session.board);
  }

  #onSolved() {
    // Thắng rồi thì ngắt luồng input chơi. Overlay đang che bàn cờ, mà undo vẫn
    // chạy được thì người chơi bấm U theo phản xạ sẽ đổi bàn cờ sau lưng overlay.
    // Nút trên overlay gắn trực tiếp nên không bị ảnh hưởng.
    this.#unroute?.();
    this.#unroute = null;

    const record = this.#progress.getRecord(this.#collectionName, this.#index);
    const bestMoves = record.completed ? record.bestMoves : 0;

    this.#progress.recordCompletion(
      this.#collectionName, this.#index, this.#session.moves, this.#session.pushes,
    );

    this.#panels.levelComplete.show({
      moves: this.#session.moves,
      pushes: this.#session.pushes,
      bestMoves,
      hasNext: this.#index + 1 < this.#collection.levels.length,
    });
  }

  nextLevel() {
    this.playLevel(this.#index + 1);
  }

  retryLevel() {
    this.playLevel(this.#index);
  }

  /** Gỡ hết listener của màn cũ trước khi rời đi, không thì chúng bám mãi. */
  #leaveLevel() {
    this.#unbindHud?.();
    this.#unroute?.();
    this.#unbindHud = null;
    this.#unroute = null;
    this.#session = null;
    this.#player = null;
    this.#panels.levelComplete.hide();
  }
}
