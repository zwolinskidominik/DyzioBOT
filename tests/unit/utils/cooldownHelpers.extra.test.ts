import { throttle, debounce, tryAcquireCooldown } from '../../../src/utils/cooldownHelpers';

jest.useFakeTimers();

describe('cooldownHelpers extra defaults', () => {
  test('debounce default delay (no third arg) still works', () => {
    const fn = jest.fn();
    debounce('k', fn);
    jest.advanceTimersByTime(1999);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throttle default options (leading+trailing) without passing options', () => {
    const fn = jest.fn();
    throttle('kk', fn, 50);
    throttle('kk', fn, 50);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('tryAcquireCooldown default interval blocks quickly', () => {
    const allow1 = tryAcquireCooldown('def');
    const allow2 = tryAcquireCooldown('def');
    expect(allow1).toBe(true);
    expect(allow2).toBe(false);
  });
});
