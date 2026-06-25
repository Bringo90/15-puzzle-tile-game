import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_LEVELS,
  DEFAULT_ADVENTURE_PROGRESS,
  getImageTileStyle,
  isAdventureLevelUnlocked,
  updateAdventureProgressForWin,
} from './adventure';

describe('adventure levels', () => {
  it('defines valid curated levels', () => {
    expect(ADVENTURE_LEVELS).toHaveLength(10);
    expect(ADVENTURE_LEVELS.filter((level) => level.gridSize === 3)).toHaveLength(4);
    expect(ADVENTURE_LEVELS.filter((level) => level.gridSize === 4)).toHaveLength(4);
    expect(ADVENTURE_LEVELS.filter((level) => level.gridSize === 5)).toHaveLength(2);
    expect(ADVENTURE_LEVELS[0]).toMatchObject({
      title: 'The Great Wave',
      imageSrc: '/adventure/The_Great_Wave_off_Kanagawa.jpg',
      gridSize: 3,
      maxMoves: 120,
    });
    expect(ADVENTURE_LEVELS[9]).toMatchObject({
      title: 'American Gothic',
      imageSrc: '/adventure/American_Gothic.jpg',
      gridSize: 5,
      maxMoves: 280,
    });

    ADVENTURE_LEVELS.forEach((level) => {
      expect(level.id).toBeTruthy();
      expect(level.title).toBeTruthy();
      expect(level.imageSrc).toMatch(/^\/adventure\/.+\.jpg$/);
      expect([3, 4, 5]).toContain(level.gridSize);
      expect(level.maxMoves).toBeGreaterThan(0);
      expect(level.shuffleMoves).toBeUndefined();
    });
  });

  it('maps tile numbers to their solved image slices', () => {
    expect(getImageTileStyle(1, 4, '/image.svg')).toMatchObject({
      '--tile-image': 'url("/image.svg")',
      '--tile-image-left': '0px',
      '--tile-image-top': '0px',
      '--tile-image-size': 'calc(400% + var(--tile-gap) + var(--tile-gap) + var(--tile-gap))',
    });
    expect(getImageTileStyle(6, 4, '/image.svg')).toMatchObject({
      '--tile-image-left': 'calc(-100% - var(--tile-gap))',
      '--tile-image-top': 'calc(-100% - var(--tile-gap))',
    });
    expect(getImageTileStyle(24, 5, '/image.svg')).toMatchObject({
      '--tile-image-left': 'calc(-300% - var(--tile-gap) - var(--tile-gap) - var(--tile-gap))',
      '--tile-image-top': 'calc(-400% - var(--tile-gap) - var(--tile-gap) - var(--tile-gap) - var(--tile-gap))',
      '--tile-image-size': 'calc(500% + var(--tile-gap) + var(--tile-gap) + var(--tile-gap) + var(--tile-gap))',
    });
  });

  it('unlocks levels sequentially', () => {
    expect(isAdventureLevelUnlocked(ADVENTURE_LEVELS[0].id, DEFAULT_ADVENTURE_PROGRESS)).toBe(true);
    expect(isAdventureLevelUnlocked(ADVENTURE_LEVELS[1].id, DEFAULT_ADVENTURE_PROGRESS)).toBe(false);

    const progress = updateAdventureProgressForWin(
      DEFAULT_ADVENTURE_PROGRESS,
      ADVENTURE_LEVELS[0].id,
      42,
      30,
    );

    expect(isAdventureLevelUnlocked(ADVENTURE_LEVELS[1].id, progress)).toBe(true);
  });

  it('keeps the best adventure result for each level', () => {
    const first = updateAdventureProgressForWin(DEFAULT_ADVENTURE_PROGRESS, 'level', 80, 20);
    const slower = updateAdventureProgressForWin(first, 'level', 90, 18);
    const fewerMovesTie = updateAdventureProgressForWin(slower, 'level', 80, 18);

    expect(slower.bestByLevel.level).toEqual({ timeInSeconds: 80, moves: 20 });
    expect(fewerMovesTie.bestByLevel.level).toEqual({ timeInSeconds: 80, moves: 18 });
  });
});
