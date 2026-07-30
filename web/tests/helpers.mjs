import { Board } from '../src/core/board.js';

/** Dựng một LevelData từ mảng hàng, tự pad cho các hàng bằng nhau. */
export function makeLevel(rows, name = 'test') {
  const width = Math.max(...rows.map((r) => r.length));
  return { name, width, height: rows.length, rows: rows.map((r) => r.padEnd(width)) };
}

export function makeBoard(rows) {
  return Board.fromLevel(makeLevel(rows));
}
