import { debounce, tryAcquireCooldown } from '../../../src/utils/cooldownHelpers';

/* ── debounce ─────────────────────────────────────────────── */

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls fn after the delay', () => {
    const fn = jest.fn();
    debounce('test-key', fn, 500);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on repeated calls', () => {
    const fn = jest.fn();
    debounce('key2', fn, 500);
    jest.advanceTimersByTime(300);
    debounce('key2', fn, 500);
    jest.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('handles different keys independently', () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    debounce('a', fn1, 100);
    debounce('b', fn2, 200);
    jest.advanceTimersByTime(100);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});

/* ── tryAcquireCooldown ───────────────────────────────────── */

describe('tryAcquireCooldown', () => {
  it('allows first call', () => {
    expect(tryAcquireCooldown(`cd-${Date.now()}`, 2000)).toBe(true);
  });

  it('blocks immediate repeated call', () => {
    const key = `cd-block-${Date.now()}`;
    tryAcquireCooldown(key, 100_000);
    expect(tryAcquireCooldown(key, 100_000)).toBe(false);
  });

  it('allows call after interval expires', async () => {
    const key = `cd-expire-${Date.now()}`;
    tryAcquireCooldown(key, 50);
    await new Promise((r) => setTimeout(r, 60));
    expect(tryAcquireCooldown(key, 50)).toBe(true);
  });
});
