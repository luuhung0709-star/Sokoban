import { BoardRenderer } from './view/boardRenderer.js';
import { MoveAnimator } from './view/moveAnimator.js';
import { InputRouter } from './input/inputRouter.js';
import { ProgressStore } from './progress/progressStore.js';
import { Hud } from './ui/hud.js';
import { MainMenu } from './ui/mainMenu.js';
import { LevelSelect } from './ui/levelSelect.js';
import { LevelComplete } from './ui/levelComplete.js';
import { GameFlow } from './ui/gameFlow.js';
import { SettingsPanel } from './ui/settingsPanel.js';
import { AudioService } from './audio/audioService.js';
import { HintService } from './core/hintService.js';

let collection;
try {
  const response = await fetch('src/levels/microban.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  collection = await response.json();
} catch (error) {
  // With no level set, show a message rather than leaving the player a blank screen.
  console.error(`Could not load the level set: ${error.message}`);
  document.body.dataset.screen = 'levels';
  document.getElementById('levels').innerHTML =
    '<p class="empty">Could not load the level set. Try reloading the page.</p>';
  throw error;
}

const boardEl = document.getElementById('board');
const renderer = new BoardRenderer(boardEl);
const animator = new MoveAnimator(renderer, boardEl);
const router = new InputRouter();
const progress = new ProgressStore();
const hud = new Hud(document.body, router);

const audio = new AudioService(progress);

// One worker for the whole session — spinning a new one up per level would pay the
// startup cost 155 times over.
const hintService = new HintService();

// Browsers only allow sound to start from inside a real user interaction.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// The loop never ends on its own, so a forgotten tab plays for ever. `blur` is needed
// alongside `visibilitychange`: switching to another application leaves the tab itself
// visible, so visibilitychange alone never fires and the music carries on.
window.addEventListener('blur', () => audio.suspend());
window.addEventListener('focus', () => audio.resume());
document.addEventListener('visibilitychange', () =>
  (document.hidden ? audio.suspend() : audio.resume()));

const panels = {
  menu: new MainMenu(document.body, {
    onContinue: () => {
      // Clamp it: progress can point past the level set (the set shrank, or
      // localStorage was hand-edited), and playLevel given a stray index bails out
      // silently after leaving the screen — the button then looks broken.
      const last = progress.getLastPlayedIndex(collection.collectionName);
      flow.playLevel(Math.min(Math.max(last, 0), collection.levels.length - 1));
    },
    onSelect: () => flow.showLevelSelect(),
    onSettings: () => panels.settings.show(),
  }),
  levelSelect: new LevelSelect(document.body, {
    onPick: (index) => flow.playLevel(index),
    onBack: () => flow.showMenu(),
  }),
  levelComplete: new LevelComplete(document.getElementById('complete'), {
    onNext: () => flow.nextLevel(),
    onRetry: () => flow.retryLevel(),
    onSelect: () => flow.showLevelSelect(),
  }),
  settings: new SettingsPanel(document.getElementById('settings'), {
    onToggleMusic: () => { audio.musicOn = !audio.musicOn; },
    onToggleSfx: () => { audio.sfxOn = !audio.sfxOn; },
    onRestart: () => flow.retryLevel(),
    // `dataset.screen` is what GameFlow already writes on every screen change, so the
    // panel reads the same source of truth rather than keeping a flag of its own to
    // fall out of step.
    getState: () => ({
      musicOn: audio.musicOn,
      sfxOn: audio.sfxOn,
      playing: document.body.dataset.screen === 'play',
    }),
  }),
};

document.getElementById('btn-settings').addEventListener('click', () => panels.settings.show());

const flow = new GameFlow({
  collection, progress, router, renderer, animator, hud, panels, audio, hintService,
});
flow.start();

window.addEventListener('resize', () => flow.handleResize());
