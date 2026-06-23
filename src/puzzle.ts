export type Tile = number | null;
export type Board = Tile[];
export type GridSize = 3 | 4 | 5;

export const DEFAULT_GRID_SIZE: GridSize = 4;
export const BOARD_SIZE = DEFAULT_GRID_SIZE;
export const TILE_COUNT = BOARD_SIZE * BOARD_SIZE;

export const SHUFFLE_MOVES: Record<GridSize, number> = {
  3: 30,
  4: 100,
  5: 200,
};

export type Difficulty = {
  gridSize: GridSize;
  label: string;
  stars: string;
};

export const DIFFICULTIES: Difficulty[] = [
  { gridSize: 3, label: 'Easy', stars: '★' },
  { gridSize: 4, label: 'Medium', stars: '★★' },
  { gridSize: 5, label: 'Hard', stars: '★★★' },
];

export type Direction = 'up' | 'down' | 'left' | 'right';
export type SlideAxis = 'x' | 'y';

export type SlideGroup = {
  axis: SlideAxis;
  direction: 1 | -1;
  indexes: number[];
};

export function createSolvedBoard(gridSize: GridSize = DEFAULT_GRID_SIZE): Board {
  return Array.from({ length: gridSize * gridSize }, (_, index) => (
    index === gridSize * gridSize - 1 ? null : index + 1
  ));
}

export const SOLVED_BOARD: Board = createSolvedBoard(DEFAULT_GRID_SIZE);

export function isSolved(board: Board, gridSize: GridSize = DEFAULT_GRID_SIZE): boolean {
  const solvedBoard = createSolvedBoard(gridSize);
  return board.length === solvedBoard.length && board.every((tile, index) => tile === solvedBoard[index]);
}

export function getEmptyIndex(board: Board): number {
  return board.indexOf(null);
}

export function areAdjacent(indexA: number, indexB: number, gridSize: GridSize = DEFAULT_GRID_SIZE): boolean {
  const rowA = Math.floor(indexA / gridSize);
  const colA = indexA % gridSize;
  const rowB = Math.floor(indexB / gridSize);
  const colB = indexB % gridSize;

  return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
}

export function canMove(board: Board, tileIndex: number, gridSize: GridSize = DEFAULT_GRID_SIZE): boolean {
  return tileIndex >= 0
    && tileIndex < gridSize * gridSize
    && areAdjacent(tileIndex, getEmptyIndex(board), gridSize);
}

export function moveTile(board: Board, tileIndex: number, gridSize: GridSize = DEFAULT_GRID_SIZE): Board {
  if (!canMove(board, tileIndex, gridSize)) {
    return board;
  }

  const emptyIndex = getEmptyIndex(board);
  const next = [...board];
  next[emptyIndex] = next[tileIndex];
  next[tileIndex] = null;
  return next;
}

export function getSlideGroup(
  board: Board,
  tileIndex: number,
  gridSize: GridSize = DEFAULT_GRID_SIZE,
): SlideGroup | null {
  const emptyIndex = getEmptyIndex(board);

  if (tileIndex === emptyIndex || tileIndex < 0 || tileIndex >= gridSize * gridSize) {
    return null;
  }

  const tileRow = Math.floor(tileIndex / gridSize);
  const tileCol = tileIndex % gridSize;
  const emptyRow = Math.floor(emptyIndex / gridSize);
  const emptyCol = emptyIndex % gridSize;
  const sameRow = tileRow === emptyRow;
  const sameCol = tileCol === emptyCol;

  if (!sameRow && !sameCol) {
    return null;
  }

  const step = sameRow
    ? emptyCol > tileCol ? 1 : -1
    : emptyRow > tileRow ? gridSize : -gridSize;
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

export function canSlide(board: Board, tileIndex: number, gridSize: GridSize = DEFAULT_GRID_SIZE): boolean {
  return getSlideGroup(board, tileIndex, gridSize) !== null;
}

export function slideTiles(board: Board, tileIndex: number, gridSize: GridSize = DEFAULT_GRID_SIZE): Board {
  const group = getSlideGroup(board, tileIndex, gridSize);

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

export function getMovableIndexes(board: Board, gridSize: GridSize = DEFAULT_GRID_SIZE): number[] {
  const emptyIndex = getEmptyIndex(board);
  const row = Math.floor(emptyIndex / gridSize);
  const col = emptyIndex % gridSize;
  const candidates = [
    row > 0 ? emptyIndex - gridSize : -1,
    row < gridSize - 1 ? emptyIndex + gridSize : -1,
    col > 0 ? emptyIndex - 1 : -1,
    col < gridSize - 1 ? emptyIndex + 1 : -1,
  ];

  return candidates.filter((index) => index !== -1);
}

export function getTileIndexForEmptyMove(
  board: Board,
  direction: Direction,
  gridSize: GridSize = DEFAULT_GRID_SIZE,
): number | null {
  const emptyIndex = getEmptyIndex(board);
  const row = Math.floor(emptyIndex / gridSize);
  const col = emptyIndex % gridSize;

  if (direction === 'up' && row < gridSize - 1) return emptyIndex + gridSize;
  if (direction === 'down' && row > 0) return emptyIndex - gridSize;
  if (direction === 'left' && col < gridSize - 1) return emptyIndex + 1;
  if (direction === 'right' && col > 0) return emptyIndex - 1;

  return null;
}

export function isSolvable(board: Board, gridSize: GridSize = DEFAULT_GRID_SIZE): boolean {
  const inversions = board
    .filter((tile): tile is number => tile !== null)
    .reduce((count, tile, index, tiles) => {
      const laterSmallerTiles = tiles.slice(index + 1).filter((other) => other < tile).length;
      return count + laterSmallerTiles;
    }, 0);

  if (gridSize % 2 === 1) {
    return inversions % 2 === 0;
  }

  const emptyRowFromBottom = gridSize - Math.floor(getEmptyIndex(board) / gridSize);
  return emptyRowFromBottom % 2 === 0 ? inversions % 2 === 1 : inversions % 2 === 0;
}

export function createScrambledBoard(
  gridSize: GridSize = DEFAULT_GRID_SIZE,
  moves = SHUFFLE_MOVES[gridSize],
  random = Math.random,
): Board {
  let board = createSolvedBoard(gridSize);
  let previousEmptyIndex = -1;

  for (let move = 0; move < moves; move += 1) {
    const emptyIndex = getEmptyIndex(board);
    const movable = getMovableIndexes(board, gridSize).filter((index) => index !== previousEmptyIndex);
    const candidates = movable.length > 0 ? movable : getMovableIndexes(board, gridSize);
    const nextTileIndex = candidates[Math.floor(random() * candidates.length)];
    previousEmptyIndex = emptyIndex;
    board = moveTile(board, nextTileIndex, gridSize);
  }

  if (isSolved(board, gridSize)) {
    const firstMove = getMovableIndexes(board, gridSize)[0];
    board = moveTile(board, firstMove, gridSize);
  }

  return board;
}

export function createGame(
  gridSize: GridSize = DEFAULT_GRID_SIZE,
  random = Math.random,
): { board: Board; initialBoard: Board; gridSize: GridSize } {
  const board = createScrambledBoard(gridSize, SHUFFLE_MOVES[gridSize], random);
  return {
    board,
    initialBoard: [...board],
    gridSize,
  };
}
