import { formatResults, formatWarnBar } from '../../../src/utils/embedHelpers';

/* ── formatResults ────────────────────────────────────────── */

describe('formatResults', () => {
  // Use test bot ID which is the fallback
  const BOT_ID = '1248419676740915310';

  it('returns 0 votes bar when both arrays empty', () => {
    const result = formatResults(BOT_ID, [], []);
    expect(result).toContain('0 głosów na tak');
    expect(result).toContain('0 głosów na nie');
    expect(result).toContain('0.0%');
  });

  it('shows 100% upvotes when only upvotes', () => {
    const result = formatResults(BOT_ID, ['u1', 'u2', 'u3'], []);
    expect(result).toContain('3 głosów na tak');
    expect(result).toContain('100.0%');
    expect(result).toContain('0 głosów na nie');
  });

  it('shows 100% downvotes when only downvotes', () => {
    const result = formatResults(BOT_ID, [], ['u1', 'u2']);
    expect(result).toContain('0 głosów na tak');
    expect(result).toContain('2 głosów na nie');
    expect(result).toContain('100.0%');
  });

  it('shows split percentages', () => {
    const result = formatResults(BOT_ID, ['u1'], ['u2']);
    expect(result).toContain('50.0%');
  });
});

/* ── formatWarnBar ────────────────────────────────────────── */

describe('formatWarnBar', () => {
  const BOT_ID = '1248419676740915310';

  it('returns all-empty bar for 0 warnings', () => {
    const bar = formatWarnBar(BOT_ID, 0);
    expect(bar.length).toBeGreaterThan(0);
  });

  it('returns partially filled bar for 1 warning', () => {
    const bar = formatWarnBar(BOT_ID, 1);
    expect(bar.length).toBeGreaterThan(0);
  });

  it('returns fully filled bar for 3 (max) warnings', () => {
    const bar = formatWarnBar(BOT_ID, 3);
    expect(bar.length).toBeGreaterThan(0);
  });

  it('caps at max warnings for count > 3', () => {
    const bar3 = formatWarnBar(BOT_ID, 3);
    const bar5 = formatWarnBar(BOT_ID, 5);
    expect(bar5).toBe(bar3);
  });
});
