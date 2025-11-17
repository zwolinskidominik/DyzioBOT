import { xpForLevel, deltaXp, levelFromTotalXp, computeLevelProgress } from '../../../src/utils/levelMath';

describe('utils/levelMath', () => {
  test('xpForLevel base cases', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(255);
  });

  test('deltaXp matches difference', () => {
    for (let lvl = 1; lvl < 10; lvl++) {
      const diff = xpForLevel(lvl + 1) - xpForLevel(lvl);
      expect(deltaXp(lvl + 1)).toBe(diff);
    }
  });

  test('levelFromTotalXp inverse of xpForLevel(start)', () => {
    for (let lvl = 1; lvl < 20; lvl++) {
      const start = xpForLevel(lvl);
      expect(levelFromTotalXp(start)).toBe(lvl);
    }
  });

  test('computeLevelProgress structure / boundaries', () => {
    const total = xpForLevel(5) + 10;
    const p = computeLevelProgress(total);
    expect(p.level).toBe(5);
    expect(p.xpIntoLevel).toBe(10);
    expect(p.xpForThisLevel).toBe(deltaXp(6));
    expect(p.nextLevelAt).toBe(xpForLevel(6));
    expect(p.xpToNextLevel).toBe(deltaXp(6) - 10);
    
    const justBefore = xpForLevel(6) - 1;
    const pb = computeLevelProgress(justBefore);
    expect(pb.level).toBe(5);
    expect(pb.xpToNextLevel).toBe(1);
    
    const huge = Number.MAX_SAFE_INTEGER / 2;
    const ph = computeLevelProgress(huge);
    expect(Number.isFinite(ph.level)).toBe(true);
  });

  test('computeLevelProgress: at start of next level (exact boundary)', () => {
    const lvl = 7;
    const total = xpForLevel(lvl + 1);
    const p = computeLevelProgress(total);
    expect(p.level).toBe(lvl + 1);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.xpToNextLevel).toBe(deltaXp(lvl + 2));
  });

  test('computeLevelProgress never returns negative xpIntoLevel even below level start', () => {
    const lvl = 3;
    const total = xpForLevel(lvl) - 5;
    const p = computeLevelProgress(total);
    expect(p.level).toBeLessThanOrEqual(lvl);
    expect(p.xpIntoLevel).toBeGreaterThanOrEqual(0);
    expect(p.xpIntoLevel).toBeLessThanOrEqual(p.xpForThisLevel);
  });

  test('zero total XP yields level 1 and zero progress', () => {
    const p = computeLevelProgress(0);
    expect(p.level).toBe(1);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.xpToNextLevel).toBeGreaterThanOrEqual(0);
  });

  test('negative total XP treated as zero: level 1 and progress 0', () => {
    const p = computeLevelProgress(-123);
    expect(p.level).toBe(1);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.xpToNextLevel).toBeGreaterThanOrEqual(0);
  });

  test('NaN total treated as zero: level 1 and progress 0', () => {
    const p = computeLevelProgress(NaN as any);
    expect(p.level).toBe(1);
    expect(Number.isNaN(p.xpIntoLevel)).toBe(false);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.xpToNextLevel).toBeGreaterThanOrEqual(0);
  });

  test('levelFromTotalXp handles exact squares and off-by-one around boundaries', () => {
    for (let lvl = 1; lvl < 15; lvl++) {
      const start = xpForLevel(lvl);
      const endExclusive = xpForLevel(lvl + 1);
      
      expect(levelFromTotalXp(start)).toBe(lvl);
      if (endExclusive > start + 1) {
        expect(levelFromTotalXp(start + 1)).toBe(lvl);
        expect(levelFromTotalXp(endExclusive - 1)).toBe(lvl);
      }
      expect(levelFromTotalXp(endExclusive)).toBe(lvl + 1);
    }
  });

  test("computeLevelProgress large values don't overflow and remain consistent", () => {
    const totals = [0, 1, 12345, 1e6, 1e9];
    for (const total of totals) {
      const p = computeLevelProgress(total);
      expect(p.level).toBeGreaterThanOrEqual(0);
      expect(p.xpIntoLevel).toBeGreaterThanOrEqual(0);
      expect(p.nextLevelAt).toBe(xpForLevel(p.level) + p.xpForThisLevel);
      expect(p.xpToNextLevel).toBe(Math.max(0, p.nextLevelAt - total));
    }
  });
});
