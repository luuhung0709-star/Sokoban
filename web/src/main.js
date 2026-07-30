import { Board } from './core/board.js';
import { BoardRenderer } from './view/boardRenderer.js';

const response = await fetch('src/levels/microban.json');
if (!response.ok) throw new Error(`Không tải được bộ màn: HTTP ${response.status}`);
const collection = await response.json();

const renderer = new BoardRenderer(document.getElementById('board'));
const board = Board.fromLevel(collection.levels[0]);

renderer.build(board);
renderer.fitCellSize(board);
