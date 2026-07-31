/** The seven characters of the standard Sokoban format. */
export const WALL = '#';
export const FLOOR = ' ';
export const PLAYER = '@';
export const PLAYER_ON_GOAL = '+';
export const BOX = '$';
export const BOX_ON_GOAL = '*';
export const GOAL = '.';

const GRID_CHARS = new Set([WALL, FLOOR, PLAYER, PLAYER_ON_GOAL, BOX, BOX_ON_GOAL, GOAL]);

export function isGrid(c) {
  return GRID_CHARS.has(c);
}

/** A grid character other than empty floor — tells grid rows apart from text lines. */
export function isContent(c) {
  return isGrid(c) && c !== FLOOR;
}

/**
 * Counts players, boxes and goals across an array of rows, plus the player position.
 *
 * Shared by the parser and the validator: both need exactly these three numbers, and
 * the counting rule has an easy-to-forget corner — '*' counts as both a box and a
 * goal, '+' as both a player and a goal. A separate loop in each place would mean
 * fixing the rule twice.
 */
export function countPieces(rows) {
  let players = 0, boxes = 0, goals = 0;
  let playerPos = null;

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === PLAYER || c === PLAYER_ON_GOAL) {
        players++;
        playerPos = { x, y };
      }
      if (c === BOX || c === BOX_ON_GOAL) boxes++;
      if (c === GOAL || c === BOX_ON_GOAL || c === PLAYER_ON_GOAL) goals++;
    }
  }

  return { players, boxes, goals, playerPos };
}
