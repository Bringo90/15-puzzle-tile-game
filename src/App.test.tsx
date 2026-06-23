import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { Board } from './puzzle';

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

function renderWithBoard(board: Board = ROW_SLIDE_BOARD) {
  return render(
    <App
      createInitialGame={() => ({
        board: [...board],
        initialBoard: [...board],
      })}
    />,
  );
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

describe('App drag interaction', () => {
  beforeEach(() => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not commit a drag that ends before the halfway point', () => {
    renderWithBoard();

    const tile = dragTile('Tile 5, movable', 30);

    expect(tile.getAttribute('data-cell-index')).toBe('4');
    expect(screen.getByLabelText('Elapsed time').textContent).toBe('00:00');
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
    const { container } = renderWithBoard();

    expect(container.querySelector('.game > .leaderboard')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));

    expect(screen.getByRole('dialog', { name: 'Leaderboard' })).toBeTruthy();
  });

  it('opens a completion sheet when the puzzle is solved', () => {
    renderWithBoard(ONE_MOVE_FROM_SOLVED_BOARD);

    fireEvent.click(screen.getByRole('button', { name: 'Tile 15, movable' }));

    expect(screen.getByRole('dialog', { name: 'Puzzle completed' })).toBeTruthy();
  });
});
