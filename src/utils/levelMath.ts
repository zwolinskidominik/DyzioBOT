export function xpForLevel(lvl: number): number {
  return 5 * lvl * lvl + 50 * lvl + 100;
}

export function deltaXp(lvl: number): number {
  return xpForLevel(lvl + 1) - xpForLevel(lvl);
}

export function totalXp(level: number, xpInLevel: number): number {
  return xpForLevel(level) + xpInLevel;
}
