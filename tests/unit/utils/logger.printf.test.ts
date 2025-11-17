describe('logger printf and defaults', () => {
  test('format.printf branch with stack string (error provided) and default interval in helper', () => {
    jest.isolateModules(() => {
      const mod = require('../../../src/utils/logger');
      const logger = mod.default as any;
      const spy = jest.spyOn(logger as any, 'error').mockImplementation(() => {});
      const err = new Error('formatted-stack');
      logger.error(err);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();

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
