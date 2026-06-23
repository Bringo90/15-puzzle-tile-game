import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Board,
  BOARD_SIZE,
  SOLVED_BOARD,
  SlideAxis,
  canSlide,
  createGame,
  getSlideGroup,
  isSolved,
  slideTiles,
} from './puzzle';
import { Leaderboard } from './Leaderboard';

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
  initialBoard: Board;
};

type AppProps = {
  createInitialGame?: () => GameState;
};

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
  const [{ board }, setPuzzle] = useState(createInitialGame);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [moves, setMoves] = useState(0);
  const [completedScore, setCompletedScore] = useState<{ timeInSeconds: number; moves: number } | null>(null);
  const [dragVisual, setDragVisual] = useState<DragVisual>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isCompletionSheetOpen, setIsCompletionSheetOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  const suppressNextClick = useRef(false);

  useEffect(() => {
    if (!hasStarted || isComplete) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
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
  }, []);

  const tilePositions = useMemo(
    () => new Map(board.map((tile, index) => [tile, index])),
    [board],
  );

  function applyBoard(nextBoard: Board) {
    const nextMoves = moves + 1;

    setPuzzle((current) => ({ ...current, board: nextBoard }));
    setMoves(nextMoves);
    setHasStarted(true);

    if (isSolved(nextBoard)) {
      setIsComplete(true);
      setHasStarted(false);
      setCompletedScore({
        timeInSeconds: elapsedSeconds,
        moves: nextMoves,
      });
      setIsCompletionSheetOpen(true);
    }
  }

  function handleTileMove(tile: number) {
    const tileIndex = board.indexOf(tile);
    const nextBoard = slideTiles(board, tileIndex);

    if (nextBoard !== board) {
      applyBoard(nextBoard);
    }
  }

  function newGame() {
    setPuzzle(createInitialGame());
    setElapsedSeconds(0);
    setMoves(0);
    setHasStarted(false);
    setIsComplete(false);
    setCompletedScore(null);
    setIsCompletionSheetOpen(false);
    setDragVisual(null);
    dragState.current = null;
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, tile: number) {
    const tileIndex = board.indexOf(tile);
    const group = getSlideGroup(board, tileIndex);
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
    <main className="app-shell">
      <section className="game" aria-label="15 Puzzle game">
        <header className="game__header">
          <div>
            <p className="eyebrow">Classic 15 Puzzle</p>
            <h1>Slide the grid home</h1>
          </div>
          <time className="timer" aria-label="Elapsed time">
            {formatTime(elapsedSeconds)}
          </time>
        </header>

        <div
          ref={boardRef}
          className="board"
        >
          {SOLVED_BOARD.filter((tile): tile is number => tile !== null).map((tile) => {
            const index = tilePositions.get(tile) ?? 0;
            const row = Math.floor(index / BOARD_SIZE);
            const col = index % BOARD_SIZE;
            const movable = canSlide(board, index);
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
          <button type="button" onClick={() => setIsLeaderboardOpen(true)}>Leaderboard</button>
          <button type="button" onClick={newGame}>New game</button>
        </div>
      </section>

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
            <Leaderboard />
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
              showSubmit
              title="Solved"
            />
          </section>
        </div>
      )}
    </main>
  );
}
