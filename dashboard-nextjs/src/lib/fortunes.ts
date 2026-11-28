/** Długość wróżby: bot pokazuje ją w polu embeda (limit Discorda 1024 znaki). Wspólne dla API i strony. */
export const FORTUNE_MIN = 3;
export const FORTUNE_MAX = 500;

/** Normalizacja przed zapisem: bez wielokrotnych spacji i białych znaków na brzegach. */
export function normalizeFortune(content: string): string {
  return content.replace(/[ \t]+/g, ' ').trim();
}
