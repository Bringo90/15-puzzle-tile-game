import { CSSProperties, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADVENTURE_LEVELS,
  AdventureLevel,
  AdventureProgress,
  createAdventureGame,
  getImageTileStyle,
  getStoredAdventureProgress,
  isAdventureLevelUnlocked,
  saveAdventureProgress,
  updateAdventureProgressForWin,
} from './adventure';
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
const BOARD_INTRO_MS = 700;
const CLASSIC_RESULT_DELAY_MS = 500;
const CLASSIC_RESULT_OVERLAY_MS = 800;
const CLASSIC_RESULT_RIM_MS = 220;
const ADVENTURE_RESULT_DELAY_MS = 500;
const ADVENTURE_RESULT_WIN_OVERLAY_MS = 800;
const ADVENTURE_RESULT_FAIL_OVERLAY_MS = 500;
const ADVENTURE_RESULT_RIM_MS = 220;
const HINT_HOLD_MS = 500;
const SURFACE_EXIT_MS = 220;

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

type HintHoldState = {
  hintShown: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  timeoutId: number;
};

type GameState = {
  board: Board;
  gridSize: GridSize;
  initialBoard: Board;
};

type GameMode = 'classic' | 'adventure';
type AppScreen = 'menu' | 'game';
type AdventureStatus = 'idle' | 'playing' | 'failed' | 'complete';
type AdventureResultPhase = 'idle' | 'overlay' | 'rim' | 'image' | 'card';
type ClassicResultPhase = 'idle' | 'overlay' | 'rim' | 'card';
type BoardIntroMode = 'classic' | 'adventure' | null;
type SurfaceName = 'adventure' | 'completion' | 'difficulty' | 'leaderboard' | 'theme';

type AppProps = {
  createAdventureGameForLevel?: typeof createAdventureGame;
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

export function App({ createAdventureGameForLevel = createAdventureGame, createInitialGame = createGame }: AppProps) {
  const [gridSize, setGridSize] = useState<GridSize>(getStoredGridSize);
  const [{ board, initialBoard }, setPuzzle] = useState(() => createInitialGame(gridSize));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [moves, setMoves] = useState(0);
  const [completedScore, setCompletedScore] = useState<{ timeInSeconds: number; moves: number; gridSize: GridSize } | null>(null);
  const [dragVisual, setDragVisual] = useState<DragVisual>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isDifficultyOpen, setIsDifficultyOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isAdventureOpen, setIsAdventureOpen] = useState(false);
  const [isCompletionSheetOpen, setIsCompletionSheetOpen] = useState(false);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [boardIntroMode, setBoardIntroMode] = useState<BoardIntroMode>(null);
  const [hasSettledBoardIntro, setHasSettledBoardIntro] = useState(false);
  const [adventureResultPhase, setAdventureResultPhase] = useState<AdventureResultPhase>('idle');
  const [classicResultPhase, setClassicResultPhase] = useState<ClassicResultPhase>('idle');
  const [closingSurfaces, setClosingSurfaces] = useState<Partial<Record<SurfaceName, boolean>>>({});
  const [appScreen, setAppScreen] = useState<AppScreen>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [adventureProgress, setAdventureProgress] = useState<AdventureProgress>(getStoredAdventureProgress);
  const [adventureLevel, setAdventureLevel] = useState<AdventureLevel | null>(null);
  const [adventureStatus, setAdventureStatus] = useState<AdventureStatus>('idle');
  const [themeProgress, setThemeProgress] = useState<ThemeProgress>(getStoredThemeProgress);
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(() => getStoredThemeId(themeProgress));
  const [themeMessage, setThemeMessage] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  const adventureResultTimers = useRef<number[]>([]);
  const classicResultTimers = useRef<number[]>([]);
  const boardIntroTimer = useRef<number | null>(null);
  const closingSurfaceTimers = useRef<Partial<Record<SurfaceName, number>>>({});
  const dragState = useRef<DragState | null>(null);
  const hintHoldState = useRef<HintHoldState | null>(null);
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
      updateHintHold(event.pointerId, event.clientX, event.clientY);

      if (updateDrag(event.pointerId, event.clientX, event.clientY)) {
        event.preventDefault();
      }
    }

    function handleWindowPointerUp(event: globalThis.PointerEvent) {
      const finishedDrag = finishDrag(event.pointerId, event.clientX, event.clientY, true);
      const finishedHint = finishHintHold(event.pointerId);

      if (finishedDrag || finishedHint) {
        event.preventDefault();
      }
    }

    function handleWindowPointerCancel(event: globalThis.PointerEvent) {
      const finishedDrag = finishDrag(event.pointerId, event.clientX, event.clientY, false);
      const finishedHint = finishHintHold(event.pointerId);

      if (finishedDrag || finishedHint) {
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

  useEffect(() => () => {
    clearAdventureResultTimers();
    clearClassicResultTimers();

    if (boardIntroTimer.current !== null) {
      window.clearTimeout(boardIntroTimer.current);
    }

    Object.values(closingSurfaceTimers.current).forEach((timerId) => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    });
  }, []);

  const solvedBoard = useMemo(() => createSolvedBoard(gridSize), [gridSize]);
  const displayBoard = boardIntroMode ? solvedBoard : board;
  const tilePositions = useMemo(
    () => new Map(displayBoard.map((tile, index) => [tile, index])),
    [displayBoard],
  );
  const isAdventure = gameMode === 'adventure' && adventureLevel !== null;
  const movesRemaining = adventureLevel ? Math.max(0, adventureLevel.maxMoves - moves) : 0;
  const canContinueGame = moves > 0 || hasStarted || isComplete || isAdventure;
  const nextAdventureLevel = adventureLevel ? getNextAdventureLevel(adventureLevel) : null;
  const isAdventureResultActive = isAdventure && isCompletionSheetOpen;
  const isAdventureResultVisible = isAdventureResultActive && adventureResultPhase !== 'idle';
  const isClassicResultActive = !isAdventure && isCompletionSheetOpen && completedScore !== null;
  const isClassicResultVisible = isClassicResultActive && classicResultPhase !== 'idle';
  const isAnyResultActive = isAdventureResultActive || isClassicResultActive;
  const isAnyResultVisible = isAdventureResultVisible || isClassicResultVisible;
  const showAdventureSolvedImage = isAdventureResultActive
    && adventureStatus === 'complete'
    && (adventureResultPhase === 'image' || adventureResultPhase === 'card');
  const showAdventureResultCard = isAdventureResultActive
    && (adventureResultPhase === 'card' || (adventureStatus === 'complete' && adventureResultPhase === 'image'));
  const showClassicResultCard = isClassicResultActive && classicResultPhase === 'card';

  function clearAdventureResultTimers() {
    adventureResultTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    adventureResultTimers.current = [];
  }

  function scheduleAdventureResultPhase(phase: AdventureResultPhase, delay: number) {
    const timerId = window.setTimeout(() => {
      setAdventureResultPhase(phase);
    }, delay);

    adventureResultTimers.current.push(timerId);
  }

  function clearClassicResultTimers() {
    classicResultTimers.current.forEach((timerId) => window.clearTimeout(timerId));
    classicResultTimers.current = [];
  }

  function scheduleClassicResultPhase(phase: ClassicResultPhase, delay: number) {
    const timerId = window.setTimeout(() => {
      setClassicResultPhase(phase);
    }, delay);

    classicResultTimers.current.push(timerId);
  }

  function startClassicResultSequence() {
    clearClassicResultTimers();
    setClassicResultPhase('idle');
    setIsCompletionSheetOpen(true);
    scheduleClassicResultPhase('overlay', CLASSIC_RESULT_DELAY_MS);
    scheduleClassicResultPhase('rim', CLASSIC_RESULT_DELAY_MS + CLASSIC_RESULT_OVERLAY_MS);
    scheduleClassicResultPhase('card', CLASSIC_RESULT_DELAY_MS + CLASSIC_RESULT_OVERLAY_MS + CLASSIC_RESULT_RIM_MS);
  }

  function startAdventureResultSequence(result: 'complete' | 'failed') {
    clearAdventureResultTimers();
    setAdventureResultPhase('idle');
    setIsCompletionSheetOpen(true);

    scheduleAdventureResultPhase('overlay', ADVENTURE_RESULT_DELAY_MS);

    if (result === 'failed') {
      scheduleAdventureResultPhase('card', ADVENTURE_RESULT_DELAY_MS + ADVENTURE_RESULT_FAIL_OVERLAY_MS);
      return;
    }

    scheduleAdventureResultPhase('rim', ADVENTURE_RESULT_DELAY_MS + ADVENTURE_RESULT_WIN_OVERLAY_MS);
    scheduleAdventureResultPhase('image', ADVENTURE_RESULT_DELAY_MS + ADVENTURE_RESULT_WIN_OVERLAY_MS + ADVENTURE_RESULT_RIM_MS);
  }

  function getNextAdventureLevel(level: AdventureLevel) {
    const currentIndex = ADVENTURE_LEVELS.findIndex((candidate) => candidate.id === level.id);
    return currentIndex >= 0 ? ADVENTURE_LEVELS[currentIndex + 1] ?? null : null;
  }

  function startBoardIntro(mode: Exclude<BoardIntroMode, null>) {
    setHasSettledBoardIntro(false);
    setBoardIntroMode(mode);

    if (boardIntroTimer.current !== null) {
      window.clearTimeout(boardIntroTimer.current);
    }

    boardIntroTimer.current = window.setTimeout(() => {
      setBoardIntroMode(null);
      setHasSettledBoardIntro(true);
      boardIntroTimer.current = null;
    }, BOARD_INTRO_MS);
  }

  function openSurface(name: SurfaceName, setIsOpen: (isOpen: boolean) => void) {
    const currentTimer = closingSurfaceTimers.current[name];

    if (currentTimer !== undefined) {
      window.clearTimeout(currentTimer);
      delete closingSurfaceTimers.current[name];
    }

    setClosingSurfaces((current) => ({ ...current, [name]: false }));
    setIsOpen(true);
  }

  function closeSurface(name: SurfaceName, setIsOpen: (isOpen: boolean) => void) {
    setClosingSurfaces((current) => ({ ...current, [name]: true }));

    const timerId = window.setTimeout(() => {
      setIsOpen(false);
      delete closingSurfaceTimers.current[name];
      setClosingSurfaces((current) => ({ ...current, [name]: false }));
    }, SURFACE_EXIT_MS);

    closingSurfaceTimers.current[name] = timerId;
  }

  function isSurfaceRendered(name: SurfaceName, isOpen: boolean) {
    return isOpen || closingSurfaces[name] === true;
  }

  function getSurfaceState(name: SurfaceName) {
    return closingSurfaces[name] ? 'closing' : 'open';
  }

  function resetRunState() {
    clearAdventureResultTimers();
    clearClassicResultTimers();
    setAdventureResultPhase('idle');
    setClassicResultPhase('idle');
    setElapsedSeconds(0);
    setMoves(0);
    setHasStarted(false);
    setIsComplete(false);
    setCompletedScore(null);
    setIsCompletionSheetOpen(false);
    setClosingSurfaces((current) => ({ ...current, completion: false }));
    setIsHintVisible(false);
    setDragVisual(null);
    clearHintHold();
    timerStartedAt.current = null;
    dragState.current = null;
    suppressNextClick.current = false;
  }

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
      if (gameMode === 'adventure' && adventureLevel) {
        const nextAdventureProgress = updateAdventureProgressForWin(
          adventureProgress,
          adventureLevel.id,
          nextElapsedSeconds,
          nextMoves,
        );

        saveAdventureProgress(nextAdventureProgress);
        setAdventureProgress(nextAdventureProgress);
        setAdventureStatus('complete');
        setIsComplete(true);
        setHasStarted(false);
        startAdventureResultSequence('complete');
        return;
      }

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
      startClassicResultSequence();
      return;
    }

    if (gameMode === 'adventure' && adventureLevel && nextMoves >= adventureLevel.maxMoves) {
      setAdventureStatus('failed');
      setHasStarted(false);
      startAdventureResultSequence('failed');
    }
  }

  function handleTileMove(tile: number) {
    if (boardIntroMode || isComplete || adventureStatus === 'failed') {
      return;
    }

    const tileIndex = board.indexOf(tile);
    const nextBoard = slideTiles(board, tileIndex, gridSize);

    if (nextBoard !== board) {
      applyBoard(nextBoard);
    }
  }

  function newGame() {
    if (gameMode === 'adventure' && adventureLevel) {
      startAdventureLevel(adventureLevel);
      return;
    }

    setPuzzle(createInitialGame(gridSize));
    resetRunState();
    setAppScreen('game');
    setGameMode('classic');
    setAdventureLevel(null);
    setAdventureStatus('idle');
    setThemeMessage('');
  }

  function changeDifficulty(nextGridSize: GridSize) {
    const shouldPlayClassicIntro = appScreen === 'menu';

    window.localStorage.setItem(STORAGE_KEY, String(nextGridSize));
    setGridSize(nextGridSize);
    setPuzzle(createInitialGame(nextGridSize));
    resetRunState();
    setAppScreen('game');
    setGameMode('classic');
    setAdventureLevel(null);
    setAdventureStatus('idle');
    if (shouldPlayClassicIntro) {
      startBoardIntro('classic');
    }
    setIsDifficultyOpen(false);
    setThemeMessage('');
  }

  function startAdventureLevel(level: AdventureLevel) {
    const nextGame = createAdventureGameForLevel(level);

    setGridSize(level.gridSize);
    setPuzzle(nextGame);
    resetRunState();
    startBoardIntro('adventure');
    setAppScreen('game');
    setGameMode('adventure');
    setAdventureLevel(level);
    setAdventureStatus('playing');
    closeSurface('adventure', setIsAdventureOpen);
    setThemeMessage('');
  }

  function restartAdventureLevel() {
    if (!adventureLevel) {
      return;
    }

    setGridSize(adventureLevel.gridSize);
    setPuzzle({
      board: [...initialBoard],
      gridSize: adventureLevel.gridSize,
      initialBoard: [...initialBoard],
    });
    resetRunState();
    setAdventureStatus('playing');
  }

  function completeAdventureLevelForTesting() {
    if (!adventureLevel || adventureStatus !== 'playing') {
      return;
    }

    const nextBoard = createSolvedBoard(adventureLevel.gridSize);
    const timerStart = timerStartedAt.current ?? Date.now();
    const nextElapsedSeconds = Math.floor((Date.now() - timerStart) / 1000);
    const nextAdventureProgress = updateAdventureProgressForWin(
      adventureProgress,
      adventureLevel.id,
      nextElapsedSeconds,
      moves,
    );

    saveAdventureProgress(nextAdventureProgress);
    setAdventureProgress(nextAdventureProgress);
    setPuzzle((current) => ({ ...current, board: nextBoard }));
    setElapsedSeconds(nextElapsedSeconds);
    setAdventureStatus('complete');
    setIsComplete(true);
    setHasStarted(false);
    startAdventureResultSequence('complete');
  }

  function returnToClassic() {
    setPuzzle(createInitialGame(gridSize));
    resetRunState();
    setAppScreen('game');
    setGameMode('classic');
    setAdventureLevel(null);
    setAdventureStatus('idle');
  }

  function returnToMenu() {
    clearAdventureResultTimers();
    setAdventureResultPhase('idle');
    clearHintHold();
    setIsHintVisible(false);
    setDragVisual(null);
    dragState.current = null;
    setIsCompletionSheetOpen(false);
    setAppScreen('menu');
  }

  function startNextAdventureLevel() {
    if (!nextAdventureLevel) {
      return;
    }

    startAdventureLevel(nextAdventureLevel);
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

  function clearHintHold() {
    if (hintHoldState.current) {
      window.clearTimeout(hintHoldState.current.timeoutId);
      hintHoldState.current = null;
    }
  }

  function startHintHold(pointerId: number, startX: number, startY: number) {
    if (!isAdventure || isComplete || adventureStatus !== 'playing') {
      return;
    }

    clearHintHold();
    hintHoldState.current = {
      hintShown: false,
      pointerId,
      startX,
      startY,
      timeoutId: window.setTimeout(() => {
        if (hintHoldState.current?.pointerId !== pointerId) {
          return;
        }

        hintHoldState.current.hintShown = true;
        suppressNextClick.current = true;
        setDragVisual(null);
        setIsHintVisible(true);
      }, HINT_HOLD_MS),
    };
  }

  function updateHintHold(pointerId: number, clientX: number, clientY: number) {
    const currentHint = hintHoldState.current;

    if (!currentHint || currentHint.pointerId !== pointerId || currentHint.hintShown) {
      return;
    }

    if (Math.max(Math.abs(clientX - currentHint.startX), Math.abs(clientY - currentHint.startY)) > CLICK_SLOP) {
      clearHintHold();
    }
  }

  function finishHintHold(pointerId: number): boolean {
    const currentHint = hintHoldState.current;

    if (!currentHint || currentHint.pointerId !== pointerId) {
      return false;
    }

    const wasShown = currentHint.hintShown;

    window.clearTimeout(currentHint.timeoutId);
    hintHoldState.current = null;

    if (wasShown) {
      setIsHintVisible(false);
      suppressNextClick.current = true;
    }

    return wasShown;
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, tile: number) {
    if (boardIntroMode || isComplete || adventureStatus === 'failed') {
      return;
    }

    startHintHold(event.pointerId, event.clientX, event.clientY);

    if (isAdventure) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

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
      clearHintHold();
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
    suppressNextClick.current = currentDrag.hasMoved || (hintHoldState.current?.hintShown ?? false);
    dragState.current = null;
    setDragVisual(null);

    if (shouldCommit && !hintHoldState.current?.hintShown) {
      const nextBoard = getBoardAfterDrag(currentDrag, draggedTileAdvanced);

      if (nextBoard !== currentDrag.board) {
        applyBoard(nextBoard);
      }
    }

    return true;
  }

  return (
    <main className="app-shell" data-theme={selectedThemeId}>
      {appScreen === 'menu' ? (
        <section className="main-menu" aria-label="Main menu">
          <p className="eyebrow">Sliding picture puzzle</p>
          <h1>Magic Box</h1>
          <div className="main-menu__actions">
            <button type="button" onClick={() => openSurface('difficulty', setIsDifficultyOpen)}>New Game</button>
            {canContinueGame && (
              <button type="button" onClick={() => setAppScreen('game')}>Continue Game</button>
            )}
            <button type="button" onClick={() => openSurface('adventure', setIsAdventureOpen)}>Adventure Mode</button>
            <button type="button" onClick={() => openSurface('theme', setIsThemeOpen)}>Themes</button>
            <button type="button" onClick={() => openSurface('leaderboard', setIsLeaderboardOpen)}>Leaderboard</button>
          </div>
        </section>
      ) : (
      <section className={`game${isAnyResultVisible ? ' game--result' : ''}`} aria-label="Magic Box game">
        <header className="game__header">
          <div>
            <p className="eyebrow">{isAdventure ? 'Adventure Puzzle' : 'Classic 15 Puzzle'}</p>
            <h1>Magic Box</h1>
          </div>
          <div className="stats" aria-label="Game stats">
            <time className="stat" aria-label="Elapsed time">
              <span>Time</span>
              <strong>{formatTime(elapsedSeconds)}</strong>
            </time>
            <div className="stat" aria-label="Moves">
              <span>{isAdventure ? 'Left' : 'Moves'}</span>
              <strong>{isAdventure ? movesRemaining : moves}</strong>
            </div>
          </div>
        </header>

        {isAdventure && (
          <div className="adventure-banner">
            <span>Adventure</span>
            <strong>{adventureLevel.title}</strong>
            <small>{adventureLevel.gridSize}x{adventureLevel.gridSize} · {moves} used</small>
          </div>
        )}

        <div
          ref={boardRef}
          className={[
            'board',
            boardIntroMode ? 'board--drive-in' : hasSettledBoardIntro ? 'board--intro-settled' : '',
            isAnyResultVisible ? 'board--result-elevated' : '',
            adventureResultPhase === 'rim' || classicResultPhase === 'rim' ? 'board--rim-light' : '',
          ].filter(Boolean).join(' ')}
          style={{ '--grid-size': gridSize } as CSSProperties}
        >
          {solvedBoard.filter((tile): tile is number => tile !== null).map((tile) => {
            const index = tilePositions.get(tile) ?? 0;
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const movable = !boardIntroMode && canSlide(board, board.indexOf(tile), gridSize);
            const dragOffset = dragVisual?.offsets.get(index) ?? 0;
            const isDragging = dragVisual?.offsets.has(index) ?? false;
            const xOffset = dragVisual?.axis === 'x' ? dragOffset : 0;
            const yOffset = dragVisual?.axis === 'y' ? dragOffset : 0;
            const imageTileStyle = isAdventure
              ? getImageTileStyle(tile, gridSize, adventureLevel.imageSrc)
              : {};

            return (
              <button
                className={`tile${isAdventure ? ' tile--image' : ''}`}
                data-cell-index={index}
                data-dragging={isDragging}
                data-movable={movable}
                key={tile}
                type="button"
                style={{
                  ...imageTileStyle,
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
                {isAdventure ? null : tile}
              </button>
            );
          })}
          {isAdventure && adventureLevel && (
            <div
              className="adventure-solved-image"
              data-visible={showAdventureSolvedImage}
              aria-hidden={!showAdventureSolvedImage}
            >
              <img src={adventureLevel.imageSrc} alt="" />
            </div>
          )}
        </div>

        <p className={`status${isAdventure && !hasStarted && !isComplete && adventureStatus === 'playing' ? ' status--adventure-hint' : ''}`} aria-live="polite">
          {adventureStatus === 'failed'
            ? 'No moves left. Try the level again.'
            : isComplete
              ? 'Solved. Beautifully done.'
              : hasStarted
                ? 'Timer running'
                : isAdventure
                  ? 'Press and hold any tile to preview the solution.'
                  : 'Timer starts on your first move'}
        </p>

        <div className="actions">
          <button type="button" onClick={returnToMenu}>Main Menu</button>
          <button type="button" onClick={() => openSurface('difficulty', setIsDifficultyOpen)}>Difficulty</button>
          <button type="button" onClick={newGame}>{isAdventure ? 'Retry level' : 'New game'}</button>
        </div>
        {isAdventure && adventureStatus === 'playing' && (
          <button className="test-win-button" type="button" onClick={completeAdventureLevelForTesting}>
            Test win
          </button>
        )}
        {isAnyResultActive && (
          <div
            className="adventure-result-overlay"
            data-phase={isAdventureResultActive ? adventureResultPhase : classicResultPhase}
            data-result={isAdventureResultActive ? adventureStatus : 'complete'}
            aria-hidden="true"
          />
        )}
      </section>
      )}

      {isAnyResultActive && (
        <div
          className="adventure-result-page-overlay"
          data-phase={isAdventureResultActive ? adventureResultPhase : classicResultPhase}
          data-result={isAdventureResultActive ? adventureStatus : 'complete'}
          aria-hidden="true"
        />
      )}

      {isAdventure && (
        <div
          className="adventure-hint"
          data-visible={isHintVisible}
          aria-hidden={!isHintVisible}
        >
          <img src={adventureLevel.imageSrc} alt="" />
        </div>
      )}

      {isAdventureResultActive && adventureLevel && (
        <>
          {showAdventureResultCard && (
            <div className="adventure-result-card-wrap" role="presentation">
              <section
                className="completion-sheet adventure-completion adventure-result-card"
                data-result={adventureStatus}
                role="dialog"
                aria-modal="true"
                aria-label={adventureStatus === 'failed' ? 'Level failed' : 'Level completed'}
              >
                <h2>{adventureStatus === 'failed' ? 'Out of moves' : 'Level complete'}</h2>
                <p className="leaderboard__difficulty">
                  {adventureLevel.title} · {adventureLevel.gridSize}x{adventureLevel.gridSize}
                </p>
                <div className="completion-summary">
                  <span>Time {formatTime(elapsedSeconds)}</span>
                  <span>{moves} moves</span>
                </div>
                <div className="adventure-result-actions">
                  <button type="button" onClick={returnToMenu}>Back to menu</button>
                  {adventureStatus === 'failed' ? (
                    <button type="button" onClick={restartAdventureLevel}>Retry level</button>
                  ) : nextAdventureLevel ? (
                    <button type="button" onClick={startNextAdventureLevel}>Next level</button>
                  ) : null}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {isSurfaceRendered('difficulty', isDifficultyOpen) && (
        <div
          className="modal-backdrop modal-backdrop--blur"
          data-state={getSurfaceState('difficulty')}
          role="presentation"
          onClick={() => closeSurface('difficulty', setIsDifficultyOpen)}
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
              onClick={() => closeSurface('difficulty', setIsDifficultyOpen)}
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

      {isSurfaceRendered('theme', isThemeOpen) && (
        <div
          className="modal-backdrop modal-backdrop--blur"
          data-state={getSurfaceState('theme')}
          role="presentation"
          onClick={() => closeSurface('theme', setIsThemeOpen)}
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
              onClick={() => closeSurface('theme', setIsThemeOpen)}
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

      {isSurfaceRendered('leaderboard', isLeaderboardOpen) && (
        <div
          className="modal-backdrop"
          data-state={getSurfaceState('leaderboard')}
          role="presentation"
          onClick={() => closeSurface('leaderboard', setIsLeaderboardOpen)}
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
              onClick={() => closeSurface('leaderboard', setIsLeaderboardOpen)}
              aria-label="Close leaderboard"
            >
              Close
            </button>
            <Leaderboard gridSize={gridSize} showDifficultyTabs />
          </section>
        </div>
      )}

      {isSurfaceRendered('adventure', isAdventureOpen) && (
        <div
          className="modal-backdrop modal-backdrop--blur"
          data-state={getSurfaceState('adventure')}
          role="presentation"
          onClick={() => closeSurface('adventure', setIsAdventureOpen)}
        >
          <section
            className="modal-panel adventure-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Adventure levels"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => closeSurface('adventure', setIsAdventureOpen)}
              aria-label="Close adventure"
            >
              Close
            </button>
            <h2>Adventure</h2>
            <p className="adventure-panel__hint">Hold a tile during a level to reveal the full image.</p>
            <div className="level-list">
              {ADVENTURE_LEVELS.map((level, index) => {
                const isUnlocked = isAdventureLevelUnlocked(level.id, adventureProgress);
                const isCompleted = adventureProgress.completedLevelIds.includes(level.id);
                const best = adventureProgress.bestByLevel[level.id];
                const unlockRequirement = index === 0 ? 'Unlocked' : `Complete Level ${index} to unlock`;

                return (
                  <button
                    className="level-card"
                    data-locked={!isUnlocked}
                    disabled={!isUnlocked}
                    key={level.id}
                    type="button"
                    aria-label={isUnlocked ? level.title : `Locked level ${index + 1}. ${unlockRequirement}`}
                    onClick={() => startAdventureLevel(level)}
                  >
                    {isUnlocked ? (
                      <>
                        <img src={level.imageSrc} alt="" />
                        <span>
                          <small>Level {index + 1}</small>
                          <strong>{level.title}</strong>
                          <em>
                            {level.gridSize}x{level.gridSize} · {level.maxMoves} moves
                            {best ? ` · best ${formatTime(best.timeInSeconds)}` : ''}
                          </em>
                        </span>
                        <b>{isCompleted ? 'Done' : 'Play'}</b>
                      </>
                    ) : (
                      <>
                        <span className="level-card__obscured" aria-hidden="true" />
                        <span>
                          <small>Level {index + 1}</small>
                          <strong>Locked level</strong>
                          <em>{unlockRequirement}</em>
                        </span>
                        <b>Locked</b>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {isClassicResultActive && showClassicResultCard && completedScore && (
        <div className="adventure-result-card-wrap" role="presentation">
          <section
            className="completion-sheet classic-result-card"
            role="dialog"
            aria-modal="true"
            aria-label="Puzzle completed"
          >
            <Leaderboard
              completedScore={completedScore}
              gridSize={gridSize}
              showRefresh={false}
              showSubmit
              title="Solved"
            />
            <div className="classic-result-actions">
              <button type="button" onClick={newGame}>New game</button>
              <button type="button" onClick={returnToMenu}>Back to menu</button>
            </div>
          </section>
        </div>
      )}

    </main>
  );
}
