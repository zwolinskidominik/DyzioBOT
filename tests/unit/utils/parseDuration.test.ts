import { parseRawDurationMs, parseDuration } from '../../../src/utils/parseDuration';

describe('parseRawDurationMs', () => {
  it('parses days', () => {
    expect(parseRawDurationMs('1d')).toBe(86_400_000);
    expect(parseRawDurationMs('2days')).toBe(2 * 86_400_000);
    expect(parseRawDurationMs('3 day')).toBe(3 * 86_400_000);
  });

  it('parses hours', () => {
    expect(parseRawDurationMs('1h')).toBe(3_600_000);
    expect(parseRawDurationMs('2hours')).toBe(2 * 3_600_000);
    expect(parseRawDurationMs('3 hour')).toBe(3 * 3_600_000);
  });

  it('parses minutes', () => {
    expect(parseRawDurationMs('1m')).toBe(60_000);
    expect(parseRawDurationMs('5min')).toBe(5 * 60_000);
    expect(parseRawDurationMs('10minutes')).toBe(10 * 60_000);
    expect(parseRawDurationMs('2 minute')).toBe(2 * 60_000);
  });

  it('parses seconds', () => {
    expect(parseRawDurationMs('1s')).toBe(1_000);
    expect(parseRawDurationMs('30sec')).toBe(30_000);
    expect(parseRawDurationMs('45seconds')).toBe(45_000);
    expect(parseRawDurationMs('10 second')).toBe(10_000);
  });

  it('parses combined tokens', () => {
    expect(parseRawDurationMs('1d 2h 30m')).toBe(86_400_000 + 2 * 3_600_000 + 30 * 60_000);
    expect(parseRawDurationMs('5d4h2m')).toBe(5 * 86_400_000 + 4 * 3_600_000 + 2 * 60_000);
    expect(parseRawDurationMs('1 day 2 hours')).toBe(86_400_000 + 2 * 3_600_000);
  });

  it('returns 0 for no valid tokens', () => {
    expect(parseRawDurationMs('')).toBe(0);
    expect(parseRawDurationMs('abc')).toBe(0);
    expect(parseRawDurationMs('hello world')).toBe(0);
  });
});

describe('parseDuration', () => {
  it('returns ms for valid durations within range', () => {
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('5d')).toBe(5 * 86_400_000);
    expect(parseDuration('10s')).toBe(10_000);
  });

  it('returns null for durations below 5 seconds', () => {
    expect(parseDuration('1s')).toBeNull();
    expect(parseDuration('4s')).toBeNull();
  });

  it('returns null for durations above ~28 days', () => {
    expect(parseDuration('29d')).toBeNull();
  });

  it('returns null for empty/invalid input', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('xyz')).toBeNull();
  });

  it('returns exactly 5s boundary', () => {
    expect(parseDuration('5s')).toBe(5_000);
  });
});
