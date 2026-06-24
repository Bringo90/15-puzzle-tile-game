import { CSSProperties, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Board,
  DEFAULT_GRID_SIZE,
  DIFFICULTIES,
  GridSize,
  SlideAxis,
  canSlide,
  createGame,
  createSolvedBoard,
  getSlideGroup,
  isSolved,
  slideTiles,
} from './puzzle';
import { Leaderboard } from './Leaderboard';
import {
  THEMES,
  ThemeId,
  ThemeProgress,
  getStoredThemeId,
  getStoredThemeProgress,
  getThemeUnlockMessage,
  isThemeUnlocked,
  saveThemeId,
  saveThemeProgress,
  updateThemeProgressForWin,
} from './themes';

const CLICK_SLOP = 6;

type DragState = {
  axis: SlideAxis;
  board: Board;
  direction: 1 | -1;
  followerOffset: number;
  hasMoved: boolean;
  indexes: number[];
  lockedFollowers: boolean;
  offset: number;
  pointerId: number;
  startX: number;
  startY: number;
  step: number;
  tileIndex: number;
};

type DragVisual = {
  axis: SlideAxis;
  offsets: Map<number, number>;
} | null;

type GameState = {
  board: Board;
  gridSize: GridSize;
  initialBoard: Board;
};

type AppProps = {
  createInitialGame?: (gridSize?: GridSize) => GameState;
};

const STORAGE_KEY = '15-puzzle-grid-size';

function getStoredGridSize(): GridSize {
  if (typeof window === 'undefined') {
    return DEFAULT_GRID_SIZE;
  }

  const storedGridSize = Number(window.localStorage.getItem(STORAGE_KEY));
  return storedGridSize === 3 || storedGridSize === 4 || storedGridSize === 5
    ? storedGridSize
    : DEFAULT_GRID_SIZE;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function getDragOffset(drag: DragState, clientX: number, clientY: number): number {
  const deltaX = clientX - drag.startX;
  const deltaY = clientY - drag.startY;
  const rawOffset = drag.axis === 'x' ? deltaX : deltaY;
  const distanceTowardEmpty = Math.min(
    drag.step,
    Math.max(0, rawOffset * drag.direction),
  );

  return distanceTowardEmpty * drag.direction;
}

function getDragDistance(drag: DragState, clientX: number, clientY: number): number {
  return Math.max(Math.abs(clientX - drag.startX), Math.abs(clientY - drag.startY));
}

function getDragVisual(drag: DragState, offset: number): DragVisual {
  const offsets = new Map<number, number>();

  if (!drag.lockedFollowers) {
    drag.indexes.forEach((index) => offsets.set(index, offset));
    return { axis: drag.axis, offsets };
  }

  drag.indexes.forEach((index, position) => {
    offsets.set(index, position === 0 ? offset : drag.followerOffset);
  });

  return { axis: drag.axis, offsets };
}

function getBoardAfterDrag(drag: DragState, draggedTileAdvanced: boolean): Board {
  if (!drag.lockedFollowers && !draggedTileAdvanced) {
    return drag.board;
  }

  const firstShiftedPosition = draggedTileAdvanced ? 0 : 1;
  const emptyIndex = drag.board.indexOf(null);
  const path = [...drag.indexes, emptyIndex];
  const next = [...drag.board];

  for (let index = path.length - 1; index > firstShiftedPosition; index -= 1) {
    next[path[index]] = drag.board[path[index - 1]];
  }

  next[path[firstShiftedPosition]] = null;
  return next;
}

export function App({ createInitialGame = createGame }: AppProps) {
  const [gridSize, setGridSize] = useState<GridSize>(getStoredGridSize);
  const [{ board }, setPuzzle] = useState(() => createInitialGame(gridSize));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [moves, setMoves] = useState(0);
  const [completedScore, setCompletedScore] = useState<{ timeInSeconds: number; moves: number; gridSize: GridSize } | null>(null);
  const [dragVisual, setDragVisual] = useState<DragVisual>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isDifficultyOpen, setIsDifficultyOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isCompletionSheetOpen, setIsCompletionSheetOpen] = useState(false);
  const [themeProgress, setThemeProgress] = useState<ThemeProgress>(getStoredThemeProgress);
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(() => getStoredThemeId(themeProgress));
  const [themeMessage, setThemeMessage] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  const timerStartedAt = useRef<number | null>(null);
  const suppressNextClick = useRef(false);

  useEffect(() => {
    if (!hasStarted || isComplete) {
      return;
    }

    const timerId = window.setInterval(() => {
      if (timerStartedAt.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - timerStartedAt.current) / 1000));
      }
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [hasStarted, isComplete]);

  useEffect(() => {
    function handleWindowPointerMove(event: globalThis.PointerEvent) {
      if (updateDrag(event.pointerId, event.clientX, event.clientY)) {
        event.preventDefault();
      }
    }

    function handleWindowPointerUp(event: globalThis.PointerEvent) {
      if (finishDrag(event.pointerId, event.clientX, event.clientY, true)) {
        event.preventDefault();
      }
    }

    function handleWindowPointerCancel(event: globalThis.PointerEvent) {
      if (finishDrag(event.pointerId, event.clientX, event.clientY, false)) {
        event.preventDefault();
      }
    }

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp, { passive: false });
    window.addEventListener('pointercancel', handleWindowPointerCancel, { passive: false });

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
    };
  });

  const tilePositions = useMemo(
    () => new Map(board.map((tile, index) => [tile, index])),
    [board],
  );

  const solvedBoard = useMemo(() => createSolvedBoard(gridSize), [gridSize]);

  function applyBoard(nextBoard: Board) {
    const nextMoves = moves + 1;
    const timerStart = timerStartedAt.current ?? Date.now();
    const nextElapsedSeconds = Math.floor((Date.now() - timerStart) / 1000);

    timerStartedAt.current = timerStart;

    setPuzzle((current) => ({ ...current, board: nextBoard }));
    setMoves(nextMoves);
    setElapsedSeconds(nextElapsedSeconds);
    setHasStarted(true);

    if (isSolved(nextBoard, gridSize)) {
      const nextThemeProgress = updateThemeProgressForWin(themeProgress, gridSize);

      saveThemeProgress(nextThemeProgress);
      setThemeProgress(nextThemeProgress);
      setIsComplete(true);
      setHasStarted(false);
      setCompletedScore({
        timeInSeconds: nextElapsedSeconds,
        moves: nextMoves,
        gridSize,
      });
      setIsCompletionSheetOpen(true);
    }
  }

  function handleTileMove(tile: number) {
    const tileIndex = board.indexOf(tile);
    const nextBoard = slideTiles(board, tileIndex, gridSize);

    if (nextBoard !== board) {
      applyBoard(nextBoard);
    }
  }

  function newGame() {
    setPuzzle(createInitialGame(gridSize));
    setElapsedSeconds(0);
    setMoves(0);
    setHasStarted(false);
    setIsComplete(false);
    setCompletedScore(null);
    setIsCompletionSheetOpen(false);
    setIsDifficultyOpen(false);
    setThemeMessage('');
    setDragVisual(null);
    timerStartedAt.current = null;
    dragState.current = null;
  }

  function changeDifficulty(nextGridSize: GridSize) {
    window.localStorage.setItem(STORAGE_KEY, String(nextGridSize));
    setGridSize(nextGridSize);
    setPuzzle(createInitialGame(nextGridSize));
    setElapsedSeconds(0);
    setMoves(0);
    setHasStarted(false);
    setIsComplete(false);
    setCompletedScore(null);
    setIsCompletionSheetOpen(false);
    setIsDifficultyOpen(false);
    setThemeMessage('');
    setDragVisual(null);
    timerStartedAt.current = null;
    dragState.current = null;
  }

  function handleThemeSelect(themeId: ThemeId) {
    const theme = THEMES.find((candidate) => candidate.id === themeId);

    if (!theme) {
      return;
    }

    if (!isThemeUnlocked(theme, themeProgress)) {
      setThemeMessage(getThemeUnlockMessage(theme));
      return;
    }

    saveThemeId(theme.id);
    setSelectedThemeId(theme.id);
    setThemeMessage(`${theme.name} selected.`);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, tile: number) {
    const tileIndex = board.indexOf(tile);
    const group = getSlideGroup(board, tileIndex, gridSize);
    const boardElement = boardRef.current;

    if (!group || !boardElement) {
      return;
    }

    const boardStyle = getComputedStyle(boardElement);
    const gap = Number.parseFloat(boardStyle.paddingLeft);
    const tileSize = event.currentTarget.getBoundingClientRect().width;
    const step = tileSize + (Number.isFinite(gap) ? gap : 0);

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragState.current = {
      ...group,
      board,
      followerOffset: 0,
      hasMoved: false,
      lockedFollowers: false,
      offset: 0,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      step,
      tileIndex,
    };
  }

  function updateDrag(pointerId: number, clientX: number, clientY: number): boolean {
    const currentDrag = dragState.current;

    if (!currentDrag || currentDrag.pointerId !== pointerId) {
      return false;
    }

    const offset = getDragOffset(currentDrag, clientX, clientY);

    if (getDragDistance(currentDrag, clientX, clientY) > CLICK_SLOP) {
      currentDrag.hasMoved = true;
      suppressNextClick.current = true;
    }

    if (Math.abs(offset) > Math.abs(currentDrag.followerOffset)) {
      currentDrag.followerOffset = offset;
    }

    if (currentDrag.indexes.length > 1 && Math.abs(currentDrag.followerOffset) >= currentDrag.step / 2) {
      currentDrag.lockedFollowers = true;
    }

    currentDrag.offset = offset;
    setDragVisual(getDragVisual(currentDrag, offset));

    return true;
  }

  function finishDrag(pointerId: number, clientX: number, clientY: number, shouldCommit: boolean): boolean {
    const currentDrag = dragState.current;

    if (!currentDrag || currentDrag.pointerId !== pointerId) {
      return false;
    }

    const finalOffset = getDragOffset(currentDrag, clientX, clientY);
    const traveled = getDragDistance(currentDrag, clientX, clientY);
    const draggedTileAdvanced = Math.abs(finalOffset) >= currentDrag.step / 2;

    if (Math.abs(finalOffset) > Math.abs(currentDrag.followerOffset)) {
      currentDrag.followerOffset = finalOffset;
    }

    if (currentDrag.indexes.length > 1 && Math.abs(currentDrag.followerOffset) >= currentDrag.step / 2) {
      currentDrag.lockedFollowers = true;
    }

    currentDrag.offset = finalOffset;
    currentDrag.hasMoved = currentDrag.hasMoved || traveled > CLICK_SLOP;
    suppressNextClick.current = currentDrag.hasMoved;
    dragState.current = null;
    setDragVisual(null);

    if (shouldCommit) {
      const nextBoard = getBoardAfterDrag(currentDrag, draggedTileAdvanced);

      if (nextBoard !== currentDrag.board) {
        applyBoard(nextBoard);
      }
    }

    return true;
  }

  return (
    <main className="app-shell" data-theme={selectedThemeId}>
      <section className="game" aria-label="15 Puzzle game">
        <header className="game__header">
          <div>
            <p className="eyebrow">Classic 15 Puzzle</p>
            <h1>Slide the grid home</h1>
          </div>
          <div className="stats" aria-label="Game stats">
            <time className="stat" aria-label="Elapsed time">
              <span>Time</span>
              <strong>{formatTime(elapsedSeconds)}</strong>
            </time>
            <div className="stat" aria-label="Moves">
              <span>Moves</span>
              <strong>{moves}</strong>
            </div>
          </div>
        </header>

        <div
          ref={boardRef}
          className="board"
          style={{ '--grid-size': gridSize } as CSSProperties}
        >
          {solvedBoard.filter((tile): tile is number => tile !== null).map((tile) => {
            const index = tilePositions.get(tile) ?? 0;
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const movable = canSlide(board, index, gridSize);
            const dragOffset = dragVisual?.offsets.get(index) ?? 0;
            const isDragging = dragVisual?.offsets.has(index) ?? false;
            const xOffset = dragVisual?.axis === 'x' ? dragOffset : 0;
            const yOffset = dragVisual?.axis === 'y' ? dragOffset : 0;

            return (
              <button
                className="tile"
                data-cell-index={index}
                data-dragging={isDragging}
                data-movable={movable}
                key={tile}
                type="button"
                style={{
                  transform: `translate3d(calc(${col} * (100% + var(--tile-gap)) + ${xOffset}px), calc(${row} * (100% + var(--tile-gap)) + ${yOffset}px), 0)`,
                }}
                onClick={() => {
                  if (suppressNextClick.current) {
                    suppressNextClick.current = false;
                    return;
                  }

                  handleTileMove(tile);
                }}
                onPointerDown={(event) => handlePointerDown(event, tile)}
                aria-label={`Tile ${tile}${movable ? ', movable' : ''}`}
              >
                {tile}
              </button>
            );
          })}
        </div>

        <p className="status" aria-live="polite">
          {isComplete ? 'Solved. Beautifully done.' : hasStarted ? 'Timer running' : 'Timer starts on your first move'}
        </p>

        <div className="actions">
          <button type="button" onClick={() => setIsDifficultyOpen(true)}>Difficulty</button>
          <button type="button" onClick={() => setIsThemeOpen(true)}>Themes</button>
          <button type="button" onClick={() => setIsLeaderboardOpen(true)}>Leaderboard</button>
          <button type="button" onClick={newGame}>New game</button>
        </div>
      </section>

      {isDifficultyOpen && (
        <div
          className="modal-backdrop modal-backdrop--blur"
          role="presentation"
          onClick={() => setIsDifficultyOpen(false)}
        >
          <section
            className="modal-panel difficulty-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Choose difficulty"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setIsDifficultyOpen(false)}
              aria-label="Close difficulty"
            >
              Close
            </button>
            <h2>Difficulty</h2>
            <div className="difficulty-options" role="radiogroup" aria-label="Difficulty">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  className="difficulty-option"
                  data-selected={gridSize === difficulty.gridSize}
                  key={difficulty.gridSize}
                  type="button"
                  role="radio"
                  aria-label={`${difficulty.label} ${difficulty.gridSize}x${difficulty.gridSize}`}
                  aria-checked={gridSize === difficulty.gridSize}
                  onClick={() => changeDifficulty(difficulty.gridSize)}
                >
                  <span>{difficulty.stars}</span>
                  <strong>{difficulty.label}</strong>
                  <small>{difficulty.gridSize}x{difficulty.gridSize}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {isThemeOpen && (
        <div
          className="modal-backdrop modal-backdrop--blur"
          role="presentation"
          onClick={() => setIsThemeOpen(false)}
        >
          <section
            className="modal-panel theme-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Choose theme"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setIsThemeOpen(false)}
              aria-label="Close themes"
            >
              Close
            </button>
            <h2>Themes</h2>
            <div className="theme-options" role="radiogroup" aria-label="Themes">
              {THEMES.map((theme) => {
                const isUnlocked = isThemeUnlocked(theme, themeProgress);
                const isSelected = selectedThemeId === theme.id;

                return (
                  <button
                    className="theme-option"
                    data-locked={!isUnlocked}
                    data-selected={isSelected}
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-label={`${theme.name}${isUnlocked ? '' : ', locked'}`}
                    aria-checked={isSelected}
                    onClick={() => handleThemeSelect(theme.id)}
                  >
                    <span className="theme-option__preview" aria-hidden="true">
                      <span style={{ background: theme.preview.rim }} />
                      <span style={{ background: theme.preview.board }} />
                      <span style={{ background: theme.preview.tile }} />
                    </span>
                    <span>
                      <strong>{theme.name}</strong>
                      <small>{theme.description}</small>
                    </span>
                    <em>{isUnlocked ? isSelected ? 'Selected' : 'Available' : 'Locked'}</em>
                  </button>
                );
              })}
            </div>
            {themeMessage && <p className="theme-message" aria-live="polite">{themeMessage}</p>}
          </section>
        </div>
      )}

      {isLeaderboardOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setIsLeaderboardOpen(false)}
        >
          <section
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Leaderboard"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setIsLeaderboardOpen(false)}
              aria-label="Close leaderboard"
            >
              Close
            </button>
            <Leaderboard gridSize={gridSize} />
          </section>
        </div>
      )}

      {isCompletionSheetOpen && completedScore && (
        <div className="completion-backdrop" role="presentation">
          <section
            className="completion-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Puzzle completed"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setIsCompletionSheetOpen(false)}
              aria-label="Close completion panel"
            >
              Close
            </button>
            <Leaderboard
              completedScore={completedScore}
              gridSize={gridSize}
              showSubmit
              title="Solved"
            />
          </section>
        </div>
      )}
    </main>
  );
}
