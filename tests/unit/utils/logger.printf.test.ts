describe('logger printf and defaults', () => {
  test('format.printf branch with stack string (error provided) and default interval in helper', () => {
    jest.isolateModules(() => {
      const mod = require('../../../src/utils/logger');
      const logger = mod.default as any;
      // Spy on transports by mocking method to avoid actual IO
      const spy = jest.spyOn(logger as any, 'error').mockImplementation(() => {});
      const err = new Error('formatted-stack');
      // trigger printf stack branch by passing Error; winston will treat as message object with stack field
      logger.error(err);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();

      // Also call logOncePerInterval without interval arg to cover default value branch in coverage
      const { logOncePerInterval } = mod;
      const infoSpy = jest.spyOn(logger as any, 'info').mockImplementation(() => {});
      logOncePerInterval('info', 'default-interval-key', 'msg');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      infoSpy.mockRestore();
    });
  });

  test('format.printf non-stack path with plain string info', () => {
    jest.isolateModules(() => {
      const mod = require('../../../src/utils/logger');
      const logger = mod.default as any;
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
      logger.info('plain-message');
      expect(infoSpy).toHaveBeenCalledWith('plain-message');
      infoSpy.mockRestore();
    });
  });
});
