describe('logger format.printf execution and mkdir catch', () => {
  test('printf runs for both error (stack) and non-error (no stack)', (done) => {
    jest.isolateModules(() => {
      const mod = require('../../../src/utils/logger');
      const logger = mod.default as any;
      const winston = require('winston') as typeof import('winston');
      const { PassThrough } = require('stream') as typeof import('stream');

      if (Array.isArray(logger.transports)) {
        for (const t of [...logger.transports]) {
          if (t instanceof (winston.transports as any).File) {
            logger.remove(t);
          }
        }
      }

      const pt = new PassThrough();
      const outputs: string[] = [];
      pt.on('data', (chunk: Buffer) => outputs.push(chunk.toString()));

      const streamTransport = new (winston.transports as any).Stream({
        stream: pt,
        level: 'debug',
      });
      logger.add(streamTransport);

      logger.error(new Error('boom'));
      logger.info('hello');

      setImmediate(() => {
        const joined = outputs.join('\n');
        expect(joined).toMatch(/\[ERROR\]/i);
        expect(joined).toMatch(/\[INFO\]/i);
        expect(joined).toMatch(/hello/);
        expect(joined).toMatch(/boom/);
        done();
      });
    });
  });
});
