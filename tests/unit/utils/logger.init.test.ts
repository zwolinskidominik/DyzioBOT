describe('utils/logger module init', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test('handles mkdirSync error gracefully at import time', () => {
    const fs = require('fs');
    jest.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => {
      jest.isolateModules(() => {
        const lg = require('../../../src/utils/logger').default;
        expect(lg).toBeDefined();
      });
    }).not.toThrow();
  });
});
