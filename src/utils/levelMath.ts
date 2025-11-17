export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let sum = 0;
  for (let i = 2; i <= level; i++) {
    sum += deltaXp(i);
  }
  return sum;
}

export function deltaXp(level: number): number {
  if (level < 1) return 0;
  if (level === 1) return 0;
  return 5 * level * level + 30 * level + 20;
}

export function totalXp(level: number, xpInLevel: number): number {
  return xpForLevel(level) + xpInLevel;
}

export function levelFromTotalXp(total: number): number {
  if (!Number.isFinite(total) || total < 0) return 1;
  if (total === 0) return 1;
  
  let low = 1;
  let high = 1000;
  
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (xpForLevel(mid) <= total) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  
  return low;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForThisLevel: number;
  xpToNextLevel: number;
  nextLevelAt: number;
}

export function computeLevelProgress(total: number): LevelProgress {
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0;
  const level = levelFromTotalXp(safeTotal);
  const startOfLevel = xpForLevel(level);
  const xpIntoLevelRaw = safeTotal - startOfLevel;
  const xpIntoLevel = Math.max(0, xpIntoLevelRaw);
  const xpForThisLevel = deltaXp(level + 1);
  const nextLevelAt = startOfLevel + xpForThisLevel;
  const xpToNextLevel = Math.max(0, nextLevelAt - safeTotal);
  return { level, xpIntoLevel, xpForThisLevel, xpToNextLevel, nextLevelAt };
}
