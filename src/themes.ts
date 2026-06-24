import { GridSize } from './puzzle';

export type ThemeId = 'classic-wood' | 'night-mode' | 'forest-trail' | 'midnight-arcade';

export type ThemeProgress = {
  completedByGrid: Record<GridSize, number>;
  completedGames: number;
};

type UnlockRequirement =
  | { type: 'completedGames'; count: number }
  | { type: 'completedGrid'; gridSize: GridSize; count: number };

export type Theme = {
  description: string;
  id: ThemeId;
  name: string;
  preview: {
    board: string;
    rim: string;
    tile: string;
  };
  unlockRequirement: UnlockRequirement | null;
};

const SELECTED_THEME_KEY = '15-puzzle-theme-id';
const THEME_PROGRESS_KEY = '15-puzzle-theme-progress';

export const DEFAULT_THEME_ID: ThemeId = 'classic-wood';

export const THEMES: Theme[] = [
  {
    id: 'classic-wood',
    name: 'Classic Wood',
    description: 'Warm wooden tray with cream tiles.',
    preview: {
      board: '#9a8366',
      rim: '#725437',
      tile: '#e9dcc3',
    },
    unlockRequirement: null,
  },
  {
    id: 'night-mode',
    name: 'Night Mode',
    description: 'A calm dark room with a warm tray.',
    preview: {
      board: '#4c473d',
      rim: '#282520',
      tile: '#efe2c6',
    },
    unlockRequirement: null,
  },
  {
    id: 'forest-trail',
    name: 'Forest Trail',
    description: 'Mossy greens and old cabin wood.',
    preview: {
      board: '#6f775d',
      rim: '#4f5a3f',
      tile: '#e1d7b8',
    },
    unlockRequirement: { type: 'completedGames', count: 3 },
  },
  {
    id: 'midnight-arcade',
    name: 'Midnight Arcade',
    description: 'A darker reward for Hard puzzle wins.',
    preview: {
      board: '#46425f',
      rim: '#27233f',
      tile: '#ece6ff',
    },
    unlockRequirement: { type: 'completedGrid', gridSize: 5, count: 1 },
  },
];

const DEFAULT_PROGRESS: ThemeProgress = {
  completedByGrid: {
    3: 0,
    4: 0,
    5: 0,
  },
  completedGames: 0,
};

export function getStoredThemeProgress(): ThemeProgress {
  if (typeof window === 'undefined') {
    return DEFAULT_PROGRESS;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(THEME_PROGRESS_KEY) ?? '');

    return {
      completedByGrid: {
        3: Number(parsed?.completedByGrid?.[3]) || 0,
        4: Number(parsed?.completedByGrid?.[4]) || 0,
        5: Number(parsed?.completedByGrid?.[5]) || 0,
      },
      completedGames: Number(parsed?.completedGames) || 0,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveThemeProgress(progress: ThemeProgress) {
  window.localStorage.setItem(THEME_PROGRESS_KEY, JSON.stringify(progress));
}

export function updateThemeProgressForWin(
  progress: ThemeProgress,
  gridSize: GridSize,
): ThemeProgress {
  return {
    completedByGrid: {
      ...progress.completedByGrid,
      [gridSize]: progress.completedByGrid[gridSize] + 1,
    },
    completedGames: progress.completedGames + 1,
  };
}

export function getStoredThemeId(progress = getStoredThemeProgress()): ThemeId {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_ID;
  }

  const storedThemeId = window.localStorage.getItem(SELECTED_THEME_KEY) as ThemeId | null;
  const theme = THEMES.find((candidate) => candidate.id === storedThemeId);

  return theme && isThemeUnlocked(theme, progress) ? theme.id : DEFAULT_THEME_ID;
}

export function saveThemeId(themeId: ThemeId) {
  window.localStorage.setItem(SELECTED_THEME_KEY, themeId);
}

export function isThemeUnlocked(theme: Theme, progress: ThemeProgress): boolean {
  if (theme.unlockRequirement === null) {
    return true;
  }

  if (theme.unlockRequirement.type === 'completedGames') {
    return progress.completedGames >= theme.unlockRequirement.count;
  }

  return progress.completedByGrid[theme.unlockRequirement.gridSize] >= theme.unlockRequirement.count;
}

export function getThemeUnlockMessage(theme: Theme): string {
  if (theme.unlockRequirement === null) {
    return 'Available now.';
  }

  if (theme.unlockRequirement.type === 'completedGames') {
    return `Complete ${theme.unlockRequirement.count} puzzles to unlock.`;
  }

  const difficultyName = theme.unlockRequirement.gridSize === 5
    ? 'Hard'
    : theme.unlockRequirement.gridSize === 4
      ? 'Medium'
      : 'Easy';

  return `Complete ${theme.unlockRequirement.count} ${difficultyName} puzzle to unlock.`;
}
