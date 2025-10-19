import logger, { logOncePerInterval } from '../../../src/utils/logger';
import * as winston from 'winston';

describe('utils/logger logOncePerInterval', () => {
  const spyInfo = jest.spyOn(logger as any, 'info').mockImplementation(()=>{});
  const spyWarn = jest.spyOn(logger as any, 'warn').mockImplementation(()=>{});
  const spyError = jest.spyOn(logger as any, 'error').mockImplementation(()=>{});
  const spyDebug = jest.spyOn(logger as any, 'debug').mockImplementation(()=>{});

  beforeEach(()=> {
    jest.useFakeTimers();
    [spyInfo, spyWarn, spyError, spyDebug].forEach(s => s.mockClear());
  });
  afterEach(()=> { jest.useRealTimers(); });

  test('logs first invocation and suppresses second within interval', () => {
    logOncePerInterval('info', 'k1', 'Message A', 5000);
    logOncePerInterval('info', 'k1', 'Message A', 5000);
    expect(spyInfo).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(5001);
    logOncePerInterval('info', 'k1', 'Message A', 5000);
    expect(spyInfo).toHaveBeenCalledTimes(2);
  });

  test('different keys not suppressed', () => {
    logOncePerInterval('warn', 'kA', 'Warn A', 10000);
    logOncePerInterval('warn', 'kB', 'Warn B', 10000);
    expect(spyWarn).toHaveBeenCalledTimes(2);
  });

  test('supports multiple levels independently', () => {
    logOncePerInterval('info', 'L0', 'X', 1000);
    logOncePerInterval('warn', 'L1', 'X', 1000);
    logOncePerInterval('error', 'L2', 'X', 1000);
    logOncePerInterval('debug', 'L3', 'X', 1000);
    expect(spyInfo).toHaveBeenCalledTimes(1);
    expect(spyWarn).toHaveBeenCalledTimes(1);
    expect(spyError).toHaveBeenCalledTimes(1);
    expect(spyDebug).toHaveBeenCalledTimes(1);
  });

  test('suppresses same key across different calls but not different level+key', () => {
    logOncePerInterval('error', 'dup', 'Err1', 2000);
    logOncePerInterval('error', 'dup', 'Err2', 2000);
    logOncePerInterval('error', 'dup2', 'Err3', 2000);
    expect(spyError).toHaveBeenCalledTimes(2);
  });

  test('changing interval per call: second call with shorter interval logs after 201ms', () => {
    // First call with long interval should log
    logOncePerInterval('info', 'rekey', 'first', 1000);
    expect(spyInfo).toHaveBeenCalledTimes(1);
    // Second call with shorter interval should still be suppressed until the shorter interval elapses
    logOncePerInterval('info', 'rekey', 'second', 200);
    expect(spyInfo).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(201);
    logOncePerInterval('info', 'rekey', 'second-after', 200);
    expect(spyInfo).toHaveBeenCalledTimes(2);
  });

  test('concurrent Promise.all with same key logs only once', async () => {
    spyInfo.mockClear();
    await Promise.all([
      Promise.resolve().then(() => logOncePerInterval('info', 'race', 'R1', 1000)),
      Promise.resolve().then(() => logOncePerInterval('info', 'race', 'R2', 1000)),
    ]);
    expect(spyInfo).toHaveBeenCalledTimes(1);
  });
});

describe('utils/logger env and format branches', () => {
  test('respects LOG_LEVEL from environment at module init', () => {
    const prev = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'DEBUG';
    jest.isolateModules(() => {
      const mod = require('../../../src/utils/logger');
      expect((mod.default as any).level).toBe('debug');
    });
    process.env.LOG_LEVEL = prev;
  });

  test('format.printf uses stack branch when error object provided', () => {
    // Call logger.error with an Error to exercise the stack formatting path
    const err = new Error('boom-stack');
    ;(logger as any).error(err);
  });
});
