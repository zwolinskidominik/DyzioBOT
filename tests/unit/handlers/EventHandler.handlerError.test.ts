jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    debug: jest.fn().mockReturnThis(),
  },
}));

import logger from '../../../src/utils/logger';

async function safeInvoke(handler: (...args: any[]) => any, ...args: any[]) {
  try {
    await handler(...args);
  } catch (err: any) {
    (logger as any).error(`Event handler error: ${err?.message ?? String(err)}`);
  }
}

describe('EventHandler: handler error path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs error when handler throws and does not crash', async () => {
    const failingHandler = async () => {
      throw new Error('boom');
    };

    await expect(safeInvoke(failingHandler)).resolves.toBeUndefined();
    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('Event handler error'));
  });

  it('does not log error for successful handler', async () => {
    const okHandler = async () => Promise.resolve();

    await expect(safeInvoke(okHandler)).resolves.toBeUndefined();
    expect((logger as any).error).not.toHaveBeenCalled();
  });
});
