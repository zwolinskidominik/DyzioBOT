/**
 * Shared duration parser used by moderation commands and giveaway system.
 *
 * Supported tokens: d/days, h/hours, m/min/minutes, s/sec/seconds
 * Example inputs: "1d 2h 30m", "5d4h2m", "1 day 2 hours"
 *
 * @returns total milliseconds (0 when no tokens matched)
 */
export function parseRawDurationMs(durationStr: string): number {
  const regex = /(\d+)\s*(d(?:ays?)?|h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi;
  let totalMs = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('d')) totalMs += value * 86_400_000;
    else if (unit.startsWith('h')) totalMs += value * 3_600_000;
    else if (unit.startsWith('m')) totalMs += value * 60_000;
    else if (unit.startsWith('s')) totalMs += value * 1_000;
  }

  return totalMs;
}

/** Min 5 s, max ~28 days */
const MIN_DURATION = 5_000;
const MAX_DURATION = 2.419e9;

/**
 * Parse a human-readable duration string with validation.
 * Returns `null` when the string has no valid tokens or the result
 * falls outside the 5 s – 28 d range (used by moderation commands).
 */
export function parseDuration(durationStr: string): number | null {
  const totalMs = parseRawDurationMs(durationStr);
  if (!totalMs || totalMs < MIN_DURATION || totalMs > MAX_DURATION) return null;
  return totalMs;
}
