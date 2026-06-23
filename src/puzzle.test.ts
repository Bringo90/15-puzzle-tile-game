import { describe, expect, it } from 'vitest';
import {
  Board,
  SOLVED_BOARD,
  createGame,
  createScrambledBoard,
  createSolvedBoard,
  getSlideGroup,
  getMovableIndexes,
  isSolvable,
  isSolved,
  moveTile,
  slideTiles,
} from './puzzle';

describe('puzzle logic', () => {
  it('generates a solvable scrambled board that is not already solved', () => {
    const board = createScrambledBoard();

    expect(board).toHaveLength(16);
    expect(new Set(board).size).toBe(16);
    expect(isSolvable(board)).toBe(true);
    expect(isSolved(board)).toBe(false);
  });

  it('generates the correct board size for each difficulty', () => {
    ([3, 4, 5] as const).forEach((gridSize) => {
      const board = createScrambledBoard(gridSize);

      expect(board).toHaveLength(gridSize * gridSize);
      expect(new Set(board).size).toBe(gridSize * gridSize);
      expect(isSolvable(board, gridSize)).toBe(true);
      expect(isSolved(board, gridSize)).toBe(false);
    });
  });

  it('moves only tiles adjacent to the empty cell', () => {
    const board: Board = [
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, null, 15,
    ];

    expect(moveTile(board, 15)).toEqual(SOLVED_BOARD);
    expect(moveTile(board, 0)).toBe(board);
  });

  it('moves and solves variable-sized boards', () => {
    const easyBoard: Board = [
      1, 2, 3,
      4, 5, 6,
      7, null, 8,
    ];
    const hardBoard: Board = [
      1, 2, 3, 4, 5,
      6, 7, 8, 9, 10,
      11, 12, 13, 14, 15,
      16, 17, 18, 19, 20,
      21, 22, 23, null, 24,
    ];

    expect(moveTile(easyBoard, 8, 3)).toEqual(createSolvedBoard(3));
    expect(moveTile(hardBoard, 24, 5)).toEqual(createSolvedBoard(5));
    expect(isSolved(createSolvedBoard(3), 3)).toBe(true);
    expect(isSolved(createSolvedBoard(5), 5)).toBe(true);
  });

  it('slides one, two, or three tiles in the empty row', () => {
    const board: Board = [
      1, 2, 3, 4,
      5, 6, 7, null,
      9, 10, 11, 8,
      13, 14, 15, 12,
    ];

    expect(slideTiles(board, 6)).toEqual([
      1, 2, 3, 4,
      5, 6, null, 7,
      9, 10, 11, 8,
      13, 14, 15, 12,
    ]);
    expect(slideTiles(board, 5)).toEqual([
      1, 2, 3, 4,
      5, null, 6, 7,
      9, 10, 11, 8,
      13, 14, 15, 12,
    ]);
    expect(slideTiles(board, 4)).toEqual([
      1, 2, 3, 4,
      null, 5, 6, 7,
      9, 10, 11, 8,
      13, 14, 15, 12,
    ]);
  });

  it('slides multiple tiles in the empty column', () => {
    const board: Board = [
      1, 2, null, 4,
      5, 6, 3, 8,
      9, 10, 7, 12,
      13, 14, 11, 15,
    ];

    expect(getSlideGroup(board, 14)).toEqual({
      axis: 'y',
      direction: -1,
      indexes: [14, 10, 6],
    });
    expect(slideTiles(board, 14)).toEqual([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, null, 15,
    ]);
  });

  it('does not slide tiles outside the empty row or column', () => {
    const board: Board = [
      1, 2, 3, 4,
      5, 6, 7, null,
      9, 10, 11, 8,
      13, 14, 15, 12,
    ];

    expect(getSlideGroup(board, 0)).toBeNull();
    expect(slideTiles(board, 0)).toBe(board);
  });

  it('detects the solved state', () => {
    expect(isSolved(SOLVED_BOARD)).toBe(true);
    expect(isSolved([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, null, 15])).toBe(false);
  });

  it('keeps the original scramble separate for restart and creates fresh new games', () => {
    const first = createGame(4, () => 0.1);
    const moved = moveTile(first.board, getMovableIndexes(first.board)[0]);
    const restarted = [...first.initialBoard];
    const second = createGame(4, () => 0.9);

    expect(moved).not.toEqual(first.initialBoard);
    expect(restarted).toEqual(first.initialBoard);
    expect(second.initialBoard).toEqual(second.board);
    expect(second.initialBoard).not.toEqual(first.initialBoard);
  });
});
