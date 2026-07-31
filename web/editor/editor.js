import { parseMicroban } from '../src/levels/parseMicroban.js';
import { validateLevel } from '../src/levels/levelValidator.js';
import { WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, PLAYER, PLAYER_ON_GOAL } from '../src/levels/sokobanChars.js';

const BRUSHES = [
  { char: WALL, label: 'Wall #' },
  { char: FLOOR, label: 'Floor' },
  { char: GOAL, label: 'Goal .' },
  { char: BOX, label: 'Box $' },
  { char: BOX_ON_GOAL, label: 'Box on goal *' },
  { char: PLAYER, label: 'Player @' },
  { char: PLAYER_ON_GOAL, label: 'Player on goal +' },
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
  // Keep the size of the grid currently drawn rather than reading the inputs — the
  // user may have typed new numbers without pressing Resize. On an empty grid, fall
  // back to the inputs, since rows[0].length would throw.
  const width = rows[0]?.length ?? Number(widthEl.value);
  const height = rows.length || Number(heightEl.value);
  rows = makeEmpty(width, height);
  drawGrid();
});

document.getElementById('btn-check').addEventListener('click', () => {
  const issues = validateLevel(currentLevel());
  issuesEl.textContent = issues.length === 0 ? 'Level is valid.' : issues.join('\n');
});

document.getElementById('btn-export').addEventListener('click', () => {
  ioEl.value = JSON.stringify(currentLevel(), null, 1);
  ioEl.select();
});

document.getElementById('btn-download').addEventListener('click', () => {
  const level = currentLevel();
  const url = URL.createObjectURL(new Blob([JSON.stringify(level, null, 1)], { type: 'application/json' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = `${level.name}.json`;
  link.click();

  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('click', () => {
  const { levels, errors } = parseMicroban(ioEl.value);
  const lines = [...errors];

  if (levels.length === 0) {
    lines.push('No level could be read.');
  } else {
    // Importing several levels takes the first — this editor edits one at a time.
    rows = [...levels[0].rows];
    widthEl.value = String(levels[0].width);
    heightEl.value = String(levels[0].height);
    drawGrid();
    lines.push(`Loaded level "${levels[0].name}" (${levels.length} level(s) in the source).`);
  }

  // Collect errors and result, then write once. Writing step by step makes the parse
  // errors vanish as soon as at least one level reads — exactly when they matter most.
  // Writing once also clears the previous press's message.
  issuesEl.textContent = lines.join('\n');
});

buildBrushes();
rows = makeEmpty(Number(widthEl.value), Number(heightEl.value));
drawGrid();
