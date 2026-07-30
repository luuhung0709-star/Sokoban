import { GameSession } from './core/gameSession.js';
import { BoardRenderer } from './view/boardRenderer.js';
import { MoveAnimator } from './view/moveAnimator.js';
import { LevelPlayer } from './view/levelPlayer.js';
import { InputRouter } from './input/inputRouter.js';
import { Hud } from './ui/hud.js';

const response = await fetch('src/levels/microban.json');
if (!response.ok) throw new Error(`Không tải được bộ màn: HTTP ${response.status}`);
const collection = await response.json();

const boardEl = document.getElementById('board');
const renderer = new BoardRenderer(boardEl);
const animator = new MoveAnimator(renderer, boardEl);
const router = new InputRouter();
const hud = new Hud(document.body, router);

const session = new GameSession(collection.levels[0]);
const player = new LevelPlayer({
  session,
  renderer,
  animator,
  router,
  hooks: { onSolved: () => console.log('Thắng màn!') },
});

hud.setLevelLabel(`Màn ${session.levelName}`);
hud.bind(session);

router.onCommand((command) => player.handle(command));
router.attach();
player.start();

window.addEventListener('resize', () => {
  renderer.fitCellSize(session.board);
});
