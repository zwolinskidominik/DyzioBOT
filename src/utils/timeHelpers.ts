/**
 * Milliseconds remaining until the next local midnight (00:00:00) in the
 * given IANA timezone, computed from the current instant. The Node process
 * itself may run in UTC (no `TZ` env var is set) — this reads the wall-clock
 * time via `Intl.DateTimeFormat` so callers get a correct result regardless
 * of the host's own timezone.
 */
export function getMsUntilMidnight(timeZone = 'Europe/Warsaw'): number {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);

  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);

  // Intl can report hour "24" for midnight depending on locale/runtime — normalize to 0.
  const hour = get('hour') % 24;
  const minute = get('minute');
  const second = get('second');

  const msIntoDay = ((hour * 60 + minute) * 60 + second) * 1000 + now.getMilliseconds();
  const msPerDay = 24 * 60 * 60 * 1000;

  return msPerDay - msIntoDay;
}

/**
 * Format milliseconds as a clock string (H:MM:SS or M:SS).
 * Used for track durations and time formatting.
 */
export function formatClock(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
