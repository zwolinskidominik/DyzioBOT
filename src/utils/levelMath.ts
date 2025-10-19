/**
 * Całkowity XP wymagany aby WEJŚĆ na dany poziom (start poziomu).
 * level=0 -> 100, level=1 -> 155, ...
 */
export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

/**
 * Różnica XP między początkiem levelu L a początkiem levelu L+1.
 * Zamieniono obliczenie na zamkniętą formułę (redukcja dwóch wywołań + jaśniejsze).
 * deltaXp(L) = xpForLevel(L+1) - xpForLevel(L) = 10L + 55
 */
export function deltaXp(level: number): number {
  return 10 * level + 55;
}

/**
 * Łączny XP przy danym poziomie + postęp w poziomie.
 */
export function totalXp(level: number, xpInLevel: number): number {
  return xpForLevel(level) + xpInLevel;
}

/**
 * Szybkie wyliczenie poziomu z całkowitego XP bez iteracji po poziomach (rozwiązanie kwadratowe).
 * Równanie: total = 5L^2 + 50L + 100  => L = floor((-50 + sqrt(500 + 20*total)) / 10)
 */
export function levelFromTotalXp(total: number): number {
  if (!Number.isFinite(total) || total < 0) return 0;
  const raw = (-50 + Math.sqrt(500 + 20 * total)) / 10;
  return Math.max(0, Math.floor(raw));
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number; // xp w bieżącym poziomie
  xpForThisLevel: number; // ile potrzeba aby przejść TEN poziom (deltaXp(level))
  xpToNextLevel: number; // ile jeszcze potrzeba
  nextLevelAt: number; // total XP wymagany na START kolejnego poziomu
}

export function computeLevelProgress(total: number): LevelProgress {
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0;
  const level = levelFromTotalXp(safeTotal);
  const startOfLevel = xpForLevel(level);
  const xpIntoLevelRaw = safeTotal - startOfLevel;
  const xpIntoLevel = Math.max(0, xpIntoLevelRaw);
  const xpForThisLevel = deltaXp(level);
  const nextLevelAt = startOfLevel + xpForThisLevel;
  const xpToNextLevel = Math.max(0, nextLevelAt - safeTotal);
  return { level, xpIntoLevel, xpForThisLevel, xpToNextLevel, nextLevelAt };
}
