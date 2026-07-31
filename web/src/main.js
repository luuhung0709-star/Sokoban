import { BoardRenderer } from './view/boardRenderer.js';
import { MoveAnimator } from './view/moveAnimator.js';
import { InputRouter } from './input/inputRouter.js';
import { ProgressStore } from './progress/progressStore.js';
import { Hud } from './ui/hud.js';
import { MainMenu } from './ui/mainMenu.js';
import { LevelSelect } from './ui/levelSelect.js';
import { LevelComplete } from './ui/levelComplete.js';
import { GameFlow } from './ui/gameFlow.js';
import { AudioService } from './audio/audioService.js';

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

// Browsers only allow sound to start from inside a real user interaction.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

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
    onToggleMute: () => {
      audio.muted = !audio.muted;
      panels.menu.refresh(progress, collection.collectionName, collection.levels);
      refreshMuteButton();
    },
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
};

const hudMute = document.getElementById('btn-mute');
const refreshMuteButton = () => {
  hudMute.textContent = audio.muted ? '🔇' : '🔊';
  hudMute.setAttribute('aria-pressed', String(audio.muted));
};
hudMute.addEventListener('click', () => {
  audio.muted = !audio.muted;
  refreshMuteButton();
});
refreshMuteButton();

const flow = new GameFlow({ collection, progress, router, renderer, animator, hud, panels, audio });
flow.start();

window.addEventListener('resize', () => flow.handleResize());
