import { isGrid, isContent, countPieces } from './sokobanChars.js';

const TITLE_PREFIX = 'Title:';

/**
 * Reads a Microban text file. Returns both the levels it could read and a list of
 * errors: one broken level must not break the whole collection.
 */
export function parseMicroban(text) {
  const result = { levels: [], errors: [] };
  if (!text) return result;

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    const blockStartLine = i + 1;         // 1-based line number for error messages
    const block = [];
    while (i < lines.length && lines[i].trim() !== '') block.push(lines[i++]);

    tryAddLevel(block, blockStartLine, result);
  }

  return result;
}

function tryAddLevel(block, blockStartLine, result) {
  const rows = [];
  let name = null;

  for (const line of block) {
    if (line.startsWith(TITLE_PREFIX)) {
      name = line.slice(TITLE_PREFIX.length).trim();
      continue;
    }
    if (isGridLine(line)) rows.push(line);
  }

  // A header block has no grid rows at all — skip it, this is not an error.
  if (rows.length === 0) return;

  const { players, boxes, goals } = countPieces(rows);

  if (players !== 1) {
    result.errors.push(`Line ${blockStartLine}: must have exactly 1 player, found ${players}`);
    return;
  }
  if (boxes === 0) {
    result.errors.push(`Line ${blockStartLine}: level has no boxes`);
    return;
  }
  if (boxes !== goals) {
    result.errors.push(`Line ${blockStartLine}: ${boxes} box(es) but ${goals} goal(s)`);
    return;
  }

  const width = Math.max(...rows.map((r) => r.length));

  result.levels.push({
    name: name || `Level ${result.levels.length + 1}`,
    width,
    height: rows.length,
    rows: rows.map((r) => r.padEnd(width)),
  });
}

/** A grid row = only the 7 valid characters, and at least one that is not a space. */
function isGridLine(line) {
  let hasContent = false;
  for (const c of line) {
    if (!isGrid(c)) return false;
    if (isContent(c)) hasContent = true;
  }
  return hasContent;
}
