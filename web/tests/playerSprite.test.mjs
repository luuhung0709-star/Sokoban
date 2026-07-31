import test from 'node:test';
import assert from 'node:assert/strict';
import { Direction } from '../src/core/direction.js';
import { BoardRenderer } from '../src/view/boardRenderer.js';
import { makeBoard } from './helpers.mjs';

/**
 * DOM giả tối thiểu — vừa đủ cho BoardRenderer dựng cây và tìm lại phần tử.
 *
 * Lý do có file này: toàn bộ phần chọn sprite theo hướng nhìn và theo trạng thái
 * đẩy trước nay không có test nào phủ, nên mỗi lần nghi ngờ "sao không thấy quay
 * người" đều phải đoán. Test này trả lời dứt điểm bằng cách chạy code thật.
 */
function makeElement(tag) {
  return {
    tagName: tag,
    className: '',
    dataset: {},
    style: { setProperty() {} },
    children: [],
    set textContent(_) { this.children = []; },
    get textContent() { return ''; },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, on) { on ? this._set.add(c) : this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    append(...kids) { this.children.push(...kids); },
    addEventListener() {},
    querySelector(sel) {
      const want = sel.replace(/^\./, '');
      const walk = (node) => {
        for (const kid of node.children) {
          if (String(kid.className).split(/\s+/).includes(want)) return kid;
          const found = walk(kid);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },
  };
}

globalThis.document = { createElement: makeElement };

function build(rows = ['#####', '#@$.#', '#####']) {
  const board = makeBoard(rows);
  const renderer = new BoardRenderer(makeElement('div'));
  renderer.build(board);
  return { board, renderer };
}

const spriteOf = (renderer) => renderer.playerEl.querySelector('.actor__sprite').src;

test('mặc định nhìn xuống', () => {
  const { renderer } = build();
  assert.match(spriteOf(renderer), /player_down\.png$/);
});

test('quay lên thì đổi sang sprite nhìn từ sau lưng', () => {
  const { renderer } = build();

  renderer.setPlayerFacing(Direction.Up);

  assert.match(spriteOf(renderer), /player_up\.png$/);
});

test('đổi đủ bốn hướng', () => {
  const { renderer } = build();
  for (const [dir, file] of [
    [Direction.Left, 'player_left'],
    [Direction.Right, 'player_right'],
    [Direction.Up, 'player_up'],
    [Direction.Down, 'player_down'],
  ]) {
    renderer.setPlayerFacing(dir);
    assert.match(spriteOf(renderer), new RegExp(`${file}\\.png$`), `hướng ${dir}`);
  }
});

test('đang áp vào hộp thì dùng sprite tư thế đẩy của đúng hướng đó', () => {
  const { renderer } = build();

  renderer.setPlayerFacing(Direction.Up);
  renderer.setPlayerPushing(true);

  assert.match(spriteOf(renderer), /player_push_up\.png$/);
});

test('rời khỏi hộp thì quay lại sprite thường, vẫn đúng hướng', () => {
  const { renderer } = build();
  renderer.setPlayerFacing(Direction.Up);
  renderer.setPlayerPushing(true);

  renderer.setPlayerPushing(false);

  assert.match(spriteOf(renderer), /player_up\.png$/);
});

test('đang đẩy mà quay hướng khác thì đổi sang sprite đẩy của hướng mới', () => {
  const { renderer } = build();
  renderer.setPlayerPushing(true);
  renderer.setPlayerFacing(Direction.Left);

  assert.match(spriteOf(renderer), /player_push_left\.png$/);
});

test('playerFacing báo đúng hướng hiện tại', () => {
  const { renderer } = build();
  renderer.setPlayerFacing(Direction.Right);
  assert.equal(renderer.playerFacing, Direction.Right);
});

test('dựng lại bàn cờ thì hướng nhìn về mặc định, không giữ hướng màn cũ', () => {
  const { renderer, board } = build();
  renderer.setPlayerFacing(Direction.Up);

  renderer.build(board);

  assert.equal(renderer.playerFacing, Direction.Down);
  assert.match(spriteOf(renderer), /player_down\.png$/);
});
