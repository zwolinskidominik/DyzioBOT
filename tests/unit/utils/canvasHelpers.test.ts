import { formatNumberDotSep, formatNumberCompact } from '../../../src/utils/canvasHelpers';

/* ── formatNumberDotSep ───────────────────────────────────── */

describe('formatNumberDotSep', () => {
  it('returns "0" for 0', () => {
    expect(formatNumberDotSep(0)).toBe('0');
  });

  it('returns number as-is when < 1000', () => {
    expect(formatNumberDotSep(999)).toBe('999');
  });

  it('inserts dot separator for thousands', () => {
    expect(formatNumberDotSep(1234)).toBe('1.234');
  });

  it('inserts multiple dot separators', () => {
    expect(formatNumberDotSep(1234567)).toBe('1.234.567');
  });

  it('handles exact thousand boundary', () => {
    expect(formatNumberDotSep(1000)).toBe('1.000');
  });
});

/* ── formatNumberCompact ──────────────────────────────────── */

describe('formatNumberCompact', () => {
  it('uses dot sep for numbers < 10000', () => {
    expect(formatNumberCompact(1234)).toBe('1.234');
  });

  it('returns k suffix for numbers >= 10000', () => {
    expect(formatNumberCompact(12345)).toBe('12.3k');
  });

  it('returns M suffix for numbers >= 1 million', () => {
    expect(formatNumberCompact(1234567)).toBe('1.2M');
  });

  it('handles exact 10000', () => {
    expect(formatNumberCompact(10000)).toBe('10.0k');
  });

  it('handles exact 1000000', () => {
    expect(formatNumberCompact(1000000)).toBe('1.0M');
  });

  it('handles 0', () => {
    expect(formatNumberCompact(0)).toBe('0');
  });

  it('handles 9999 (just below k threshold)', () => {
    expect(formatNumberCompact(9999)).toBe('9.999');
  });
});
