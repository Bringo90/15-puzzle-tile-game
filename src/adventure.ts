import { CSSProperties } from 'react';
import { Board, GridSize, SHUFFLE_MOVES, createScrambledBoard } from './puzzle';

type ImageTileStyle = CSSProperties & {
  '--tile-image': string;
  '--tile-image-left': string;
  '--tile-image-top': string;
  '--tile-image-size': string;
};

export type AdventureLevel = {
  id: string;
  title: string;
  imageSrc: string;
  gridSize: GridSize;
  maxMoves: number;
  shuffleMoves?: number;
};

export type AdventureProgress = {
  completedLevelIds: string[];
  bestByLevel: Record<string, { timeInSeconds: number; moves: number }>;
};

export type AdventureGame = {
  board: Board;
  gridSize: GridSize;
  initialBoard: Board;
};

const ADVENTURE_PROGRESS_KEY = '15-puzzle-adventure-progress';

export const ADVENTURE_LEVELS: AdventureLevel[] = [
  {
    id: 'sunset-harbor',
    title: 'Sunset Harbor',
    imageSrc: '/adventure/sunset-harbor.svg',
    gridSize: 3,
    maxMoves: 80,
    shuffleMoves: 30,
  },
  {
    id: 'forest-cabin',
    title: 'Forest Cabin',
    imageSrc: '/adventure/forest-cabin.svg',
    gridSize: 4,
    maxMoves: 180,
    shuffleMoves: 100,
  },
  {
    id: 'mountain-night',
    title: 'Mountain Night',
    imageSrc: '/adventure/mountain-night.svg',
    gridSize: 5,
    maxMoves: 320,
    shuffleMoves: 200,
  },
];

export const DEFAULT_ADVENTURE_PROGRESS: AdventureProgress = {
  completedLevelIds: [],
  bestByLevel: {},
};

export function createAdventureGame(
  level: AdventureLevel,
  random = Math.random,
): AdventureGame {
  const board = createScrambledBoard(
    level.gridSize,
    level.shuffleMoves ?? SHUFFLE_MOVES[level.gridSize],
    random,
  );

  return {
    board,
    gridSize: level.gridSize,
    initialBoard: [...board],
  };
}

export function getImageTileStyle(
  tile: number,
  gridSize: GridSize,
  imageSrc: string,
): ImageTileStyle {
  const solvedIndex = tile - 1;
  const row = Math.floor(solvedIndex / gridSize);
  const col = solvedIndex % gridSize;

  return {
    '--tile-image': `url("${imageSrc}")`,
    '--tile-image-left': getImageOffset(col),
    '--tile-image-top': getImageOffset(row),
    '--tile-image-size': getImageSize(gridSize),
  };
}

function getRepeatedGapCalc(count: number): string {
  return Array.from({ length: count }, () => 'var(--tile-gap)').join(' + ');
}

function getImageSize(gridSize: GridSize): string {
  const gaps = getRepeatedGapCalc(gridSize - 1);
  return gaps ? `calc(${gridSize * 100}% + ${gaps})` : `${gridSize * 100}%`;
}

function getImageOffset(index: number): string {
  if (index === 0) {
    return '0px';
  }

  const gaps = Array.from({ length: index }, () => 'var(--tile-gap)').join(' - ');
  return gaps ? `calc(-${index * 100}% - ${gaps})` : `-${index * 100}%`;
}

export function getStoredAdventureProgress(): AdventureProgress {
  if (typeof window === 'undefined') {
    return DEFAULT_ADVENTURE_PROGRESS;
  }

  try {
    const storedProgress = window.localStorage.getItem(ADVENTURE_PROGRESS_KEY);

    if (!storedProgress) {
      return DEFAULT_ADVENTURE_PROGRESS;
    }

    const parsedProgress = JSON.parse(storedProgress) as Partial<AdventureProgress>;
    const completedLevelIds = Array.isArray(parsedProgress.completedLevelIds)
      ? parsedProgress.completedLevelIds.filter((id): id is string => typeof id === 'string')
      : [];
    const bestByLevel = parsedProgress.bestByLevel && typeof parsedProgress.bestByLevel === 'object'
      ? parsedProgress.bestByLevel
      : {};

    return { completedLevelIds, bestByLevel };
  } catch {
    return DEFAULT_ADVENTURE_PROGRESS;
  }
}

export function saveAdventureProgress(progress: AdventureProgress) {
  window.localStorage.setItem(ADVENTURE_PROGRESS_KEY, JSON.stringify(progress));
}

export function isAdventureLevelUnlocked(
  levelId: string,
  progress: AdventureProgress,
  levels = ADVENTURE_LEVELS,
): boolean {
  const levelIndex = levels.findIndex((level) => level.id === levelId);

  if (levelIndex <= 0) {
    return levelIndex === 0;
  }

  return progress.completedLevelIds.includes(levels[levelIndex - 1].id);
}

export function updateAdventureProgressForWin(
  progress: AdventureProgress,
  levelId: string,
  timeInSeconds: number,
  moves: number,
): AdventureProgress {
  const previousBest = progress.bestByLevel[levelId];
  const nextBest = !previousBest
    || timeInSeconds < previousBest.timeInSeconds
    || (timeInSeconds === previousBest.timeInSeconds && moves < previousBest.moves)
    ? { timeInSeconds, moves }
    : previousBest;

  return {
    completedLevelIds: progress.completedLevelIds.includes(levelId)
      ? progress.completedLevelIds
      : [...progress.completedLevelIds, levelId],
    bestByLevel: {
      ...progress.bestByLevel,
      [levelId]: nextBest,
    },
  };
}
