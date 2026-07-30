import { parseMicroban } from '../src/levels/parseMicroban.js';
import { validateLevel } from '../src/levels/levelValidator.js';
import { WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, PLAYER, PLAYER_ON_GOAL } from '../src/levels/sokobanChars.js';

const BRUSHES = [
  { char: WALL, label: 'Tường #' },
  { char: FLOOR, label: 'Nền' },
  { char: GOAL, label: 'Đích .' },
  { char: BOX, label: 'Hộp $' },
  { char: BOX_ON_GOAL, label: 'Hộp trên đích *' },
  { char: PLAYER, label: 'Người @' },
  { char: PLAYER_ON_GOAL, label: 'Người trên đích +' },
];

const gridEl = document.getElementById('grid');
const issuesEl = document.getElementById('issues');
const ioEl = document.getElementById('io');
const widthEl = document.getElementById('width');
const heightEl = document.getElementById('height');

let brush = WALL;
let rows = [];

function makeEmpty(width, height) {
  return Array.from({ length: height }, () => FLOOR.repeat(width));
}

function setCell(x, y, char) {
  const row = rows[y];
  rows[y] = row.slice(0, x) + char + row.slice(x + 1);
}

function drawGrid() {
  const width = rows[0]?.length ?? 0;
  gridEl.style.gridTemplateColumns = `repeat(${width}, 26px)`;
  gridEl.textContent = '';

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.char = row[x];
      cell.textContent = row[x] === FLOOR ? '' : row[x];
      cell.addEventListener('click', () => {
        setCell(x, y, brush);
        drawGrid();
      });
      gridEl.append(cell);
    }
  });
}

function currentLevel() {
  const width = Math.max(...rows.map((r) => r.length));
  return { name: 'editor', width, height: rows.length, rows: rows.map((r) => r.padEnd(width)) };
}

function buildBrushes() {
  const bar = document.getElementById('brushes');
  BRUSHES.forEach(({ char, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn brush';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(char === brush));
    button.addEventListener('click', () => {
      brush = char;
      for (const other of bar.children) other.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
    });
    bar.append(button);
  });
}

document.getElementById('btn-resize').addEventListener('click', () => {
  rows = makeEmpty(Number(widthEl.value), Number(heightEl.value));
  drawGrid();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  rows = makeEmpty(rows[0].length, rows.length);
  drawGrid();
});

document.getElementById('btn-check').addEventListener('click', () => {
  const issues = validateLevel(currentLevel());
  issuesEl.textContent = issues.length === 0 ? 'Màn hợp lệ.' : issues.join('\n');
});

document.getElementById('btn-export').addEventListener('click', () => {
  ioEl.value = JSON.stringify(currentLevel(), null, 1);
  ioEl.select();
});

document.getElementById('btn-import').addEventListener('click', () => {
  const { levels, errors } = parseMicroban(ioEl.value);
  if (errors.length > 0) issuesEl.textContent = errors.join('\n');

  if (levels.length === 0) {
    issuesEl.textContent = `${issuesEl.textContent}\nKhông đọc được màn nào.`.trim();
    return;
  }

  // Import nhiều màn thì lấy màn đầu — editor này sửa từng màn một.
  rows = [...levels[0].rows];
  widthEl.value = String(levels[0].width);
  heightEl.value = String(levels[0].height);
  drawGrid();
  issuesEl.textContent = `Đã nạp màn "${levels[0].name}" (${levels.length} màn trong nguồn).`;
});

buildBrushes();
rows = makeEmpty(Number(widthEl.value), Number(heightEl.value));
drawGrid();
