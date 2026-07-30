import { CellType, boxKey } from './board.js';
import { toDelta } from './direction.js';

/** Tính kết quả một nước đi. Hàm thuần — không đổi board. */
export function resolve(board, dir) {
  const { dx, dy } = toDelta(dir);
  const from = { ...board.player };
  const to = { x: from.x + dx, y: from.y + dy };

  const blockedMove = {
    dir, blocked: true, push: false,
    from, to: { ...from }, boxFrom: null, boxTo: null,
  };

  if (board.cellAt(to.x, to.y) === CellType.Wall) return blockedMove;

  if (board.hasBox(to.x, to.y)) {
    const boxTo = { x: to.x + dx, y: to.y + dy };
    // Đẩy vào tường hoặc vào hộp khác đều không được.
    if (board.cellAt(boxTo.x, boxTo.y) === CellType.Wall || board.hasBox(boxTo.x, boxTo.y)) {
      return blockedMove;
    }
    return { dir, blocked: false, push: true, from, to, boxFrom: { ...to }, boxTo };
  }

  return { dir, blocked: false, push: false, from, to, boxFrom: null, boxTo: null };
}

export function apply(board, move) {
  if (move.blocked) return;

  if (move.push) {
    board.boxes.delete(boxKey(move.boxFrom.x, move.boxFrom.y));
    board.boxes.add(boxKey(move.boxTo.x, move.boxTo.y));
  }
  board.player = { ...move.to };
}

export function revert(board, move) {
  if (move.blocked) return;

  if (move.push) {
    board.boxes.delete(boxKey(move.boxTo.x, move.boxTo.y));
    board.boxes.add(boxKey(move.boxFrom.x, move.boxFrom.y));
  }
  board.player = { ...move.from };
}
