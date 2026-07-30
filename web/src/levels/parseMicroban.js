import { isGrid, isContent, countPieces } from './sokobanChars.js';

const TITLE_PREFIX = 'Title:';

/**
 * Đọc file Microban dạng text. Trả về cả màn đọc được lẫn danh sách lỗi:
 * một màn hỏng không được làm hỏng cả bộ.
 */
export function parseMicroban(text) {
  const result = { levels: [], errors: [] };
  if (!text) return result;

  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    const blockStartLine = i + 1;         // số dòng 1-based cho thông báo lỗi
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

  // Khối header không có hàng lưới nào — bỏ qua, đây không phải lỗi.
  if (rows.length === 0) return;

  const { players, boxes, goals } = countPieces(rows);

  if (players !== 1) {
    result.errors.push(`Dòng ${blockStartLine}: phải có đúng 1 người chơi, đang có ${players}`);
    return;
  }
  if (boxes === 0) {
    result.errors.push(`Dòng ${blockStartLine}: màn không có hộp nào`);
    return;
  }
  if (boxes !== goals) {
    result.errors.push(`Dòng ${blockStartLine}: ${boxes} hộp nhưng ${goals} đích`);
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

/** Hàng lưới = chỉ gồm 7 ký tự hợp lệ và có ít nhất một ký tự khác dấu cách. */
function isGridLine(line) {
  let hasContent = false;
  for (const c of line) {
    if (!isGrid(c)) return false;
    if (isContent(c)) hasContent = true;
  }
  return hasContent;
}
