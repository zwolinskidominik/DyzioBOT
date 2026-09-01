/**
 * Polska odmiana rzeczownika po liczebniku: 1 → forms[0], 2–4 (poza 12–14) → forms[1],
 * pozostałe (0, 5+, 11–14, 21, 22... z wyjątkiem 12–14) → forms[2].
 * Przykład: plural(1, ["streamer", "streamerów", "streamerów"]) === "streamer"
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const last = abs % 10;
  const last2 = abs % 100;
  if (abs === 1) return forms[0];
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return forms[1];
  return forms[2];
}
