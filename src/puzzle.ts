export type Tile = number | null;
export type Board = Tile[];

export const BOARD_SIZE = 4;
export const TILE_COUNT = BOARD_SIZE * BOARD_SIZE;
export const SOLVED_BOARD: Board = [
  1, 2, 3, 4,
  5, 6, 7, 8,
  9, 10, 11, 12,
  13, 14, 15, null,
];

export type Direction = 'up' | 'down' | 'left' | 'right';
export type SlideAxis = 'x' | 'y';

export type SlideGroup = {
  axis: SlideAxis;
  direction: 1 | -1;
  indexes: number[];
};

export function isSolved(board: Board): boolean {
  return board.every((tile, index) => tile === SOLVED_BOARD[index]);
}

export function getEmptyIndex(board: Board): number {
  return board.indexOf(null);
}

export function areAdjacent(indexA: number, indexB: number): boolean {
  const rowA = Math.floor(indexA / BOARD_SIZE);
  const colA = indexA % BOARD_SIZE;
  const rowB = Math.floor(indexB / BOARD_SIZE);
  const colB = indexB % BOARD_SIZE;

  return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
}

export function canMove(board: Board, tileIndex: number): boolean {
  return tileIndex >= 0 && tileIndex < TILE_COUNT && areAdjacent(tileIndex, getEmptyIndex(board));
}

export function moveTile(board: Board, tileIndex: number): Board {
  if (!canMove(board, tileIndex)) {
    return board;
  }

  const emptyIndex = getEmptyIndex(board);
  const next = [...board];
  next[emptyIndex] = next[tileIndex];
  next[tileIndex] = null;
  return next;
}

export function getSlideGroup(board: Board, tileIndex: number): SlideGroup | null {
  const emptyIndex = getEmptyIndex(board);

  if (tileIndex === emptyIndex || tileIndex < 0 || tileIndex >= TILE_COUNT) {
    return null;
  }

  const tileRow = Math.floor(tileIndex / BOARD_SIZE);
  const tileCol = tileIndex % BOARD_SIZE;
  const emptyRow = Math.floor(emptyIndex / BOARD_SIZE);
  const emptyCol = emptyIndex % BOARD_SIZE;
  const sameRow = tileRow === emptyRow;
  const sameCol = tileCol === emptyCol;

  if (!sameRow && !sameCol) {
    return null;
  }

  const step = sameRow
    ? emptyCol > tileCol ? 1 : -1
    : emptyRow > tileRow ? BOARD_SIZE : -BOARD_SIZE;
  const indexes: number[] = [];

  for (let index = tileIndex; index !== emptyIndex; index += step) {
    indexes.push(index);
  }

  return {
    axis: sameRow ? 'x' : 'y',
    direction: step > 0 ? 1 : -1,
    indexes,
  };
}

export function canSlide(board: Board, tileIndex: number): boolean {
  return getSlideGroup(board, tileIndex) !== null;
}

export function slideTiles(board: Board, tileIndex: number): Board {
  const group = getSlideGroup(board, tileIndex);

  if (!group) {
    return board;
  }

  const next = [...board];
  const path = [...group.indexes, getEmptyIndex(board)];

  for (let index = path.length - 1; index > 0; index -= 1) {
    next[path[index]] = board[path[index - 1]];
  }

  next[path[0]] = null;
  return next;
}

export function getMovableIndexes(board: Board): number[] {
  const emptyIndex = getEmptyIndex(board);
  const row = Math.floor(emptyIndex / BOARD_SIZE);
  const col = emptyIndex % BOARD_SIZE;
  const candidates = [
    row > 0 ? emptyIndex - BOARD_SIZE : -1,
    row < BOARD_SIZE - 1 ? emptyIndex + BOARD_SIZE : -1,
    col > 0 ? emptyIndex - 1 : -1,
    col < BOARD_SIZE - 1 ? emptyIndex + 1 : -1,
  ];

  return candidates.filter((index) => index !== -1);
}

export function getTileIndexForEmptyMove(board: Board, direction: Direction): number | null {
  const emptyIndex = getEmptyIndex(board);
  const row = Math.floor(emptyIndex / BOARD_SIZE);
  const col = emptyIndex % BOARD_SIZE;

  if (direction === 'up' && row < BOARD_SIZE - 1) return emptyIndex + BOARD_SIZE;
  if (direction === 'down' && row > 0) return emptyIndex - BOARD_SIZE;
  if (direction === 'left' && col < BOARD_SIZE - 1) return emptyIndex + 1;
  if (direction === 'right' && col > 0) return emptyIndex - 1;

  return null;
}

export function isSolvable(board: Board): boolean {
  const inversions = board
    .filter((tile): tile is number => tile !== null)
    .reduce((count, tile, index, tiles) => {
      const laterSmallerTiles = tiles.slice(index + 1).filter((other) => other < tile).length;
      return count + laterSmallerTiles;
    }, 0);

  const emptyRowFromBottom = BOARD_SIZE - Math.floor(getEmptyIndex(board) / BOARD_SIZE);
  return emptyRowFromBottom % 2 === 0 ? inversions % 2 === 1 : inversions % 2 === 0;
}

export function createScrambledBoard(moves = 180, random = Math.random): Board {
  let board = [...SOLVED_BOARD];
  let previousEmptyIndex = -1;

  for (let move = 0; move < moves; move += 1) {
    const emptyIndex = getEmptyIndex(board);
    const movable = getMovableIndexes(board).filter((index) => index !== previousEmptyIndex);
    const nextTileIndex = movable[Math.floor(random() * movable.length)];
    previousEmptyIndex = emptyIndex;
    board = moveTile(board, nextTileIndex);
  }

  if (isSolved(board)) {
    const firstMove = getMovableIndexes(board)[0];
    board = moveTile(board, firstMove);
  }

  return board;
}

export function createGame(random = Math.random): { board: Board; initialBoard: Board } {
  const board = createScrambledBoard(180, random);
  return {
    board,
    initialBoard: [...board],
  };
}
