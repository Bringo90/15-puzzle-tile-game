import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { ADVENTURE_LEVELS } from './adventure';
import { Board, GridSize } from './puzzle';

const ROW_SLIDE_BOARD: Board = [
  1, 2, 3, 4,
  5, 6, 7, null,
  9, 10, 11, 8,
  13, 14, 15, 12,
];

const ONE_MOVE_FROM_SOLVED_BOARD: Board = [
  1, 2, 3, 4,
  5, 6, 7, 8,
  9, 10, 11, 12,
  13, 14, null, 15,
];

const DIFFICULTY_LABELS: Record<GridSize, string> = {
  3: 'Easy 3x3',
  4: 'Medium 4x4',
  5: 'Hard 5x5',
};

function renderWithBoard(
  board: Board = ROW_SLIDE_BOARD,
  gridSize: GridSize = 4,
  startGame = true,
  finishClassicIntro = true,
) {
  const result = render(
    <App
      createInitialGame={() => ({
        board: [...board],
        gridSize,
        initialBoard: [...board],
      })}
    />,
  );

  if (startGame) {
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(screen.getByRole('radio', { name: DIFFICULTY_LABELS[gridSize] }));

    if (finishClassicIntro) {
      act(() => {
        vi.advanceTimersByTime(700);
      });
    }
  }

  return result;
}

function dragTile(label: string, endX: number) {
  return dragTilePath(label, [endX]);
}

function dragTilePath(label: string, clientXs: number[]) {
  const tile = screen.getByRole('button', { name: label });
  const createPointerEvent = (type: string, clientX: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });

    Object.defineProperties(event, {
      clientX: { value: clientX },
      clientY: { value: 0 },
      pointerId: { value: 1 },
    });

    return event;
  };

  fireEvent(tile, createPointerEvent('pointerdown', 0));
  clientXs.forEach((clientX) => {
    fireEvent(window, createPointerEvent('pointermove', clientX));
  });
  fireEvent(window, createPointerEvent('pointerup', clientXs.at(-1) ?? 0));

  return tile;
}

function startDragTilePath(label: string, clientXs: number[]) {
  const tile = screen.getByRole('button', { name: label });
  const createPointerEvent = (type: string, clientX: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });

    Object.defineProperties(event, {
      clientX: { value: clientX },
      clientY: { value: 0 },
      pointerId: { value: 1 },
    });

    return event;
  };

  fireEvent(tile, createPointerEvent('pointerdown', 0));
  clientXs.forEach((clientX) => {
    fireEvent(window, createPointerEvent('pointermove', clientX));
  });

  return {
    release: (clientX: number) => fireEvent(window, createPointerEvent('pointerup', clientX)),
  };
}

function startFirstAdventureLevel(finishBoardIntro = true) {
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Adventure Mode' }));
  fireEvent.click(screen.getByRole('button', { name: /Sunset Harbor/ }));

  if (finishBoardIntro) {
    act(() => {
      vi.advanceTimersByTime(700);
    });
  }
}

describe('App drag interaction', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      paddingLeft: '8px',
      getPropertyValue: (property: string) => property === '--tile-gap' ? 'clamp(0.45rem, 2vw, 0.7rem)' : '',
    }) as CSSStyleDeclaration);

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      bottom: 80,
      height: 80,
      left: 0,
      right: 80,
      top: 0,
      width: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts on the main menu instead of the board', () => {
    renderWithBoard(ROW_SLIDE_BOARD, 4, false);

    expect(screen.getByRole('heading', { name: 'Magic Box' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adventure Mode' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Tile/ })).toBeNull();
  });

  it('opens difficulty first when starting a new game from the menu', () => {
    renderWithBoard(ROW_SLIDE_BOARD, 4, false);

    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));

    expect(screen.getByRole('dialog', { name: 'Choose difficulty' })).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Medium 4x4' }));

    expect(screen.getAllByRole('button', { name: /^Tile/ })).toHaveLength(15);
  });

  it('shows a solved classic intro before revealing the scrambled board', () => {
    renderWithBoard(ROW_SLIDE_BOARD, 4, true, false);

    expect(document.querySelector('.board')?.classList.contains('board--drive-in')).toBe(true);
    expect(screen.getByRole('button', { name: 'Tile 8' }).getAttribute('data-cell-index')).toBe('7');
    expect(screen.getByLabelText('Elapsed time').textContent).toContain('00:00');
    expect(screen.getByText('Timer starts on your first move')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(document.querySelector('.board')?.classList.contains('board--drive-in')).toBe(false);
    expect(document.querySelector('.board')?.classList.contains('board--intro-settled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Tile 8, movable' }).getAttribute('data-cell-index')).toBe('11');
  });

  it('replays the solved intro when starting another classic game from the menu', () => {
    renderWithBoard(ROW_SLIDE_BOARD, 4, true, false);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Main Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Medium 4x4' }));

    expect(document.querySelector('.board')?.classList.contains('board--drive-in')).toBe(true);
    expect(screen.getByRole('button', { name: 'Tile 8' }).getAttribute('data-cell-index')).toBe('7');
  });

  it('does not replay the solved intro on in-game classic new games', () => {
    renderWithBoard(ROW_SLIDE_BOARD, 4, true, false);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));

    expect(document.querySelector('.board')?.classList.contains('board--drive-in')).toBe(false);
    expect(screen.getByRole('button', { name: 'Tile 8, movable' }).getAttribute('data-cell-index')).toBe('11');
  });

  it('does not commit a drag that ends before the halfway point', () => {
    renderWithBoard();

    const tile = dragTile('Tile 5, movable', 30);

    expect(tile.getAttribute('data-cell-index')).toBe('4');
    expect(screen.getByLabelText('Elapsed time').textContent).toContain('00:00');
  });

  it('slides every tile between the dragged tile and the empty cell', () => {
    renderWithBoard();

    dragTile('Tile 5, movable', 60);

    expect(screen.getByRole('button', { name: 'Tile 5, movable' }).getAttribute('data-cell-index')).toBe('5');
    expect(screen.getByRole('button', { name: 'Tile 6, movable' }).getAttribute('data-cell-index')).toBe('6');
    expect(screen.getByRole('button', { name: 'Tile 7, movable' }).getAttribute('data-cell-index')).toBe('7');
    expect(screen.getByText('Timer running')).toBeTruthy();
  });

  it('keeps follower tiles pushed when the dragged tile returns before release', () => {
    renderWithBoard();

    dragTilePath('Tile 5, movable', [60, 0]);

    expect(screen.getByRole('button', { name: 'Tile 5, movable' }).getAttribute('data-cell-index')).toBe('4');
    expect(screen.getByRole('button', { name: 'Tile 6, movable' }).getAttribute('data-cell-index')).toBe('6');
    expect(screen.getByRole('button', { name: 'Tile 7, movable' }).getAttribute('data-cell-index')).toBe('7');
    expect(screen.getByText('Timer running')).toBeTruthy();
  });

  it('does not snap follower tiles into place until release', () => {
    renderWithBoard();

    const drag = startDragTilePath('Tile 5, movable', [60, 20]);

    expect(screen.getByRole('button', { name: 'Tile 5, movable' }).style.transform).toContain('+ 20px');
    expect(screen.getByRole('button', { name: 'Tile 6, movable' }).style.transform).toContain('+ 60px');
    expect(screen.getByRole('button', { name: 'Tile 7, movable' }).style.transform).toContain('+ 60px');
    expect(screen.getByRole('button', { name: 'Tile 6, movable' }).style.transform).not.toContain('+ 88px');

    drag.release(20);
  });

  it('opens the leaderboard in a modal instead of showing it inline', () => {
    const { container } = renderWithBoard(ROW_SLIDE_BOARD, 4, false);

    expect(container.querySelector('.main-menu > .leaderboard')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));

    expect(screen.getByRole('dialog', { name: 'Leaderboard' })).toBeTruthy();
  });

  it('opens a completion sheet when the puzzle is solved', () => {
    renderWithBoard(ONE_MOVE_FROM_SOLVED_BOARD);

    fireEvent.click(screen.getByRole('button', { name: 'Tile 15, movable' }));

    expect(screen.getByRole('dialog', { name: 'Puzzle completed' })).toBeTruthy();
  });

  it('shows moves and resets them on a new game', () => {
    renderWithBoard();

    expect(screen.getByLabelText('Moves').textContent).toContain('0');

    fireEvent.click(screen.getByRole('button', { name: 'Tile 5, movable' }));

    expect(screen.getByLabelText('Moves').textContent).toContain('1');

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));

    expect(screen.getByLabelText('Moves').textContent).toContain('0');
  });

  it('returns to the main menu without resetting an active game', () => {
    renderWithBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Tile 5, movable' }));
    expect(screen.getByLabelText('Moves').textContent).toContain('1');

    fireEvent.click(screen.getByRole('button', { name: 'Main Menu' }));

    expect(screen.getByRole('button', { name: 'Adventure Mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue Game' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Continue Game' }));

    expect(screen.getByLabelText('Moves').textContent).toContain('1');
  });

  it('continues the move count when a drag follows a click move', () => {
    renderWithBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Tile 7, movable' }));
    expect(screen.getByLabelText('Moves').textContent).toContain('1');

    dragTile('Tile 6, movable', 60);

    expect(screen.getByLabelText('Moves').textContent).toContain('2');
  });

  it('opens difficulty choices in a modal without resetting the game', () => {
    vi.useFakeTimers();
    renderWithBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Tile 5, movable' }));
    expect(screen.getByLabelText('Moves').textContent).toContain('1');

    fireEvent.click(screen.getByRole('button', { name: 'Difficulty' }));

    expect(screen.getByRole('dialog', { name: 'Choose difficulty' })).toBeTruthy();
    expect(screen.getByLabelText('Moves').textContent).toContain('1');

    fireEvent.click(screen.getByRole('presentation'));

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByRole('dialog', { name: 'Choose difficulty' })).toBeNull();
    expect(screen.getByLabelText('Moves').textContent).toContain('1');
  });

  it('changes board size when selecting a difficulty in the modal', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Easy 3x3' }));
    expect(screen.getAllByRole('button', { name: /^Tile/ })).toHaveLength(8);

    fireEvent.click(screen.getByRole('button', { name: 'Difficulty' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hard 5x5' }));
    expect(screen.getAllByRole('button', { name: /^Tile/ })).toHaveLength(24);
  });

  it('opens theme choices and applies an available theme', () => {
    const { container } = renderWithBoard(ROW_SLIDE_BOARD, 4, false);

    expect(container.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('classic-wood');

    fireEvent.click(screen.getByRole('button', { name: 'Themes' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Night Mode' }));

    expect(container.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('night-mode');
    expect(screen.getByText('Night Mode selected.')).toBeTruthy();
  });

  it('shows unlock requirements for locked themes', () => {
    renderWithBoard(ROW_SLIDE_BOARD, 4, false);

    fireEvent.click(screen.getByRole('button', { name: 'Themes' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Forest Trail, locked' }));

    expect(screen.getByText('Complete 3 puzzles to unlock.')).toBeTruthy();
  });

  it('unlocks themes when completion progress meets the requirement', () => {
    window.localStorage.setItem('15-puzzle-theme-progress', JSON.stringify({
      completedByGrid: { 3: 0, 4: 2, 5: 0 },
      completedGames: 2,
    }));
    renderWithBoard(ONE_MOVE_FROM_SOLVED_BOARD);

    fireEvent.click(screen.getByRole('button', { name: 'Tile 15, movable' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close completion panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Main Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Themes' }));

    expect(screen.getByRole('radio', { name: 'Forest Trail' })).toBeTruthy();
  });

  it('obscures locked adventure levels and starts an unlocked image level directly', () => {
    renderWithBoard(ROW_SLIDE_BOARD, 4, false);

    fireEvent.click(screen.getByRole('button', { name: 'Adventure Mode' }));

    expect(screen.getByRole('dialog', { name: 'Adventure levels' })).toBeTruthy();
    expect(screen.getByText('Hold a tile during a level to reveal the full image.')).toBeTruthy();
    expect(screen.queryByText('Forest Cabin')).toBeNull();
    expect((screen.getByRole('button', { name: /Locked level 2/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Complete Level 1 to unlock')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Sunset Harbor/ }));

    expect(screen.getAllByText('Sunset Harbor').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Moves').textContent).toContain(String(ADVENTURE_LEVELS[0].maxMoves));
    expect(screen.queryByText('1')).toBeNull();
    expect(document.querySelector('.board')?.classList.contains('board--drive-in')).toBe(true);
  });

  it('decrements the adventure move countdown on committed moves', () => {
    renderWithBoard(ROW_SLIDE_BOARD, 4, false);

    startFirstAdventureLevel();

    const firstMovableTile = screen.getAllByRole('button', { name: /movable/ })[0];
    fireEvent.click(firstMovableTile);

    expect(screen.getByLabelText('Moves').textContent).toContain(String(ADVENTURE_LEVELS[0].maxMoves - 1));
  });

  it('shows the full adventure image on long hold without spending a move', () => {
    vi.useFakeTimers();
    renderWithBoard(ROW_SLIDE_BOARD, 4, false);

    startFirstAdventureLevel();

    const firstMovableTile = screen.getAllByRole('button', { name: /movable/ })[0];
    const createPointerEvent = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });

      Object.defineProperties(event, {
        clientX: { value: 0 },
        clientY: { value: 0 },
        pointerId: { value: 1 },
      });

      return event;
    };

    fireEvent(firstMovableTile, createPointerEvent('pointerdown'));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(document.querySelector('.adventure-hint')?.getAttribute('data-visible')).toBe('true');

    fireEvent(window, createPointerEvent('pointerup'));
    fireEvent.click(firstMovableTile);

    expect(document.querySelector('.adventure-hint')?.getAttribute('data-visible')).toBe('false');
    expect(screen.getByLabelText('Moves').textContent).toContain(String(ADVENTURE_LEVELS[0].maxMoves));
  });
});
