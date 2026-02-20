import {
  xpForLevel,
  deltaXp,
  totalXp,
  levelFromTotalXp,
  computeLevelProgress,
} from '../../../src/utils/levelMath';

/* ── xpForLevel ───────────────────────────────────────────── */

describe('xpForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it('returns 0 for level 0', () => {
    expect(xpForLevel(0)).toBe(0);
  });

  it('returns deltaXp(2) for level 2', () => {
    expect(xpForLevel(2)).toBe(deltaXp(2));
  });

  it('is monotonically increasing', () => {
    for (let i = 1; i < 20; i++) {
      expect(xpForLevel(i + 1)).toBeGreaterThan(xpForLevel(i));
    }
  });
});

/* ── deltaXp ──────────────────────────────────────────────── */

describe('deltaXp', () => {
  it('returns 0 for level 1', () => {
    expect(deltaXp(1)).toBe(0);
  });

  it('returns 0 for level < 1', () => {
    expect(deltaXp(0)).toBe(0);
    expect(deltaXp(-1)).toBe(0);
  });

  it('returns 5*n*n + 30*n + 20 for level n ≥ 2', () => {
    for (const n of [2, 5, 10]) {
      expect(deltaXp(n)).toBe(5 * n * n + 30 * n + 20);
    }
  });
});

/* ── totalXp ──────────────────────────────────────────────── */

describe('totalXp', () => {
  it('equals xpForLevel(level) + xpInLevel', () => {
    expect(totalXp(5, 100)).toBe(xpForLevel(5) + 100);
  });

  it('equals xpForLevel when xpInLevel is 0', () => {
    expect(totalXp(10, 0)).toBe(xpForLevel(10));
  });
});

/* ── levelFromTotalXp ─────────────────────────────────────── */

describe('levelFromTotalXp', () => {
  it('returns 1 for 0 xp', () => {
    expect(levelFromTotalXp(0)).toBe(1);
  });

  it('returns 1 for negative xp', () => {
    expect(levelFromTotalXp(-100)).toBe(1);
  });

  it('returns 1 for NaN', () => {
    expect(levelFromTotalXp(NaN)).toBe(1);
  });

  it('is consistent with xpForLevel', () => {
    for (const lvl of [1, 2, 5, 10, 50]) {
      expect(levelFromTotalXp(xpForLevel(lvl))).toBe(lvl);
    }
  });

  it('returns correct level for xp just above a threshold', () => {
    const lvl5xp = xpForLevel(5);
    expect(levelFromTotalXp(lvl5xp + 1)).toBe(5);
  });
});

/* ── computeLevelProgress ─────────────────────────────────── */

describe('computeLevelProgress', () => {
  it('returns level 1, xpIntoLevel 0 for totalXp 0', () => {
    const p = computeLevelProgress(0);
    expect(p.level).toBe(1);
    expect(p.xpIntoLevel).toBe(0);
  });

  it('xpToNextLevel + xpIntoLevel = xpForThisLevel', () => {
    const p = computeLevelProgress(500);
    expect(p.xpIntoLevel + p.xpToNextLevel).toBe(p.xpForThisLevel);
  });

  it('handles negative totalXp safely', () => {
    const p = computeLevelProgress(-100);
    expect(p.level).toBe(1);
    expect(p.xpIntoLevel).toBe(0);
  });

  it('handles NaN totalXp safely', () => {
    const p = computeLevelProgress(NaN);
    expect(p.level).toBe(1);
  });
});
