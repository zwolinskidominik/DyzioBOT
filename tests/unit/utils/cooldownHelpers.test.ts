import { throttle, debounce, tryAcquireCooldown } from '../../../src/utils/cooldownHelpers';

jest.useFakeTimers();

describe('cooldownHelpers', () => {
  test('debounce runs only last call', () => {
    const fn = jest.fn();
    debounce('a', fn, 100);
    debounce('a', fn, 100);
    debounce('a', fn, 100);
    jest.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throttle leading', () => {
    const fn = jest.fn();
    throttle('t', fn, 100, { leading: true, trailing: false });
    throttle('t', fn, 100, { leading: true, trailing: false });
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    throttle('t', fn, 100, { leading: true, trailing: false });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('throttle trailing', () => {
    const fn = jest.fn();
    throttle('x', fn, 100, { leading: false, trailing: true });
    throttle('x', fn, 100, { leading: false, trailing: true });
    jest.advanceTimersByTime(99);
    expect(fn).toHaveBeenCalledTimes(0);
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throttle with trailing disabled: no trailing call occurs', () => {
    const fn = jest.fn();
    throttle('notrail', fn, 100, { leading: true, trailing: false });
    throttle('notrail', fn, 100, { leading: true, trailing: false });
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throttle with leading disabled: only trailing executes', () => {
    const fn = jest.fn();
    throttle('nolead', fn, 100, { leading: false, trailing: true });
    throttle('nolead', fn, 100, { leading: false, trailing: true });
    expect(fn).toHaveBeenCalledTimes(0);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('tryAcquireCooldown allows again after interval', () => {
    const key = 'allowAfter';
    expect(tryAcquireCooldown(key, 100)).toBe(true);
    expect(tryAcquireCooldown(key, 100)).toBe(false);
    jest.advanceTimersByTime(101);
    expect(tryAcquireCooldown(key, 100)).toBe(true);
  });

  test('throttle leading+trailing default burst (first immediate, one trailing)', () => {
    const fn = jest.fn();
    throttle('combo', fn, 100);
    throttle('combo', fn, 100);
    throttle('combo', fn, 100);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(99);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(100);
    throttle('combo', fn, 100);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('tryAcquireCooldown: parallel calls for same key allow only the first', async () => {
    const results = await Promise.all([
      Promise.resolve().then(() => tryAcquireCooldown('ckey', 1000)),
      Promise.resolve().then(() => tryAcquireCooldown('ckey', 1000)),
    ]);
    const allowedCount = results.filter(Boolean).length;
    expect(allowedCount).toBe(1);
  });

  test('tryAcquireCooldown: 0ms interval allows immediate second call', () => {
    const first = tryAcquireCooldown('zero', 0);
    const second = tryAcquireCooldown('zero', 0);
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  test('tryAcquireCooldown: different keys do not interfere', () => {
    const a1 = tryAcquireCooldown('kA', 1000);
    const b1 = tryAcquireCooldown('kB', 1000);
    const a2 = tryAcquireCooldown('kA', 1000);
    const b2 = tryAcquireCooldown('kB', 1000);
    expect(a1).toBe(true);
    expect(b1).toBe(true);
    expect(a2).toBe(false);
    expect(b2).toBe(false);
  });
});
