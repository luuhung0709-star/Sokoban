import { GameSession } from '../core/gameSession.js';
import { LevelPlayer } from '../view/levelPlayer.js';

/** Holds the current screen and coordinates the panels. */
export class GameFlow {
  #collection;
  #progress;
  #router;
  #renderer;
  #animator;
  #hud;
  #panels;
  #audio;
  #hintService;

  #session = null;
  #player = null;
  #index = 0;
  #unbindHud = null;
  #unroute = null;

  constructor({ collection, progress, router, renderer, animator, hud, panels, audio, hintService }) {
    this.#collection = collection;
    this.#progress = progress;
    this.#router = router;
    this.#renderer = renderer;
    this.#animator = animator;
    this.#hud = hud;
    this.#panels = panels;
    this.#audio = audio;
    this.#hintService = hintService;
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
      hintService: this.#hintService,
      hooks: {
        onExit: () => this.showLevelSelect(),
        onSolved: () => this.#onSolved(),
        onSound: (name) => this.#audio.play(name),
        onHintStart: () => this.#hud.setHintBusy(true),
        onHintDone: (found) => {
          this.#hud.setHintBusy(false);
          if (!found) this.#hud.flashNoHint();
        },
      },
    });

    this.#hud.setLevelLabel(`Level ${level.name}`);
    this.#unbindHud = this.#hud.bind(this.#session);
    this.#unroute = this.#router.onCommand((command) => this.#player.handle(command));

    document.body.dataset.screen = 'play';
    this.#player.start();
  }

  /** Window resize: recompute the cell size for the level in play. */
  handleResize() {
    if (this.#session) this.#renderer.fitCellSize(this.#session.board);
  }

  #onSolved() {
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

  /** Drop every listener from the old level before leaving, or they linger forever. */
  #leaveLevel() {
    this.#player?.stop();
    this.#unbindHud?.();
    this.#unroute?.();
    this.#unbindHud = null;
    this.#unroute = null;
    this.#session = null;
    this.#player = null;
    this.#panels.levelComplete.hide();
  }
}
