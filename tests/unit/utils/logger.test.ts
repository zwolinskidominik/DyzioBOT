jest.mock('fs', () => ({ mkdirSync: jest.fn() }));
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      printf: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

import logger from '../../../src/utils/logger';
import { createLogger } from 'winston';

describe('logger', () => {
  it('exports a winston logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('creates logger via winston createLogger', () => {
    expect(createLogger).toHaveBeenCalled();
  });

  it('logger methods are callable', () => {
    logger.info('test info');
    logger.warn('test warn');
    logger.error('test error');
    expect(logger.info).toHaveBeenCalledWith('test info');
    expect(logger.warn).toHaveBeenCalledWith('test warn');
    expect(logger.error).toHaveBeenCalledWith('test error');
  });
});
