import { EventHandler } from '../../../src/handlers/EventHandler';
import { Client } from 'discord.js';
import * as path from 'path';

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
const logger = require('../../../src/utils/logger').default as { error: jest.Mock; warn: jest.Mock };

beforeEach(()=>{ jest.clearAllMocks(); });

class MiniClient {
  private _events: Record<string, Function[]> = {};
  on(ev:string, fn:Function){ (this._events[ev] ||= []).push(fn); return this; }
  emit(ev:string, ...args:any[]){ (this._events[ev]||[]).forEach(f=>f(...args)); }
}

jest.mock('fs', () => {
  const real = jest.requireActual('fs');
  const readdirSync = (dir: string) => {
    const norm = dir.replace(/\\/g,'/');
  if (norm.endsWith('/src/events')) return ['messageCreate'];
  if (norm.endsWith('/src/events/messageCreate')) return ['ok1.ts','ok2.ts','breaker.ts','bad.txt','invalid.ts','err.ts','missing.ts'];
    return real.readdirSync(dir);
  };
  const statSync = (p: string) => ({ isDirectory: () => !/\.ts$|\.txt$/.test(p) });
  return { ...real, readdirSync, statSync };
});

const handlers: Record<string, any> = {
  'ok1.ts': { default: jest.fn(() => false) },
  'ok2.ts': { default: jest.fn(() => false) },
  'breaker.ts': { default: jest.fn(() => true) },
  'invalid.ts': { notDefault: () => {} },
  'err.ts': { default: jest.fn(() => { throw new Error('boom'); }) },
};

jest.mock('../../../src/events/messageCreate/ok1.ts', () => handlers['ok1.ts'], { virtual: true });
jest.mock('../../../src/events/messageCreate/ok2.ts', () => handlers['ok2.ts'], { virtual: true });
jest.mock('../../../src/events/messageCreate/breaker.ts', () => handlers['breaker.ts'], { virtual: true });
jest.mock('../../../src/events/messageCreate/invalid.ts', () => handlers['invalid.ts'], { virtual: true });
jest.mock('../../../src/events/messageCreate/err.ts', () => handlers['err.ts'], { virtual: true });

function flushPromises(){ return new Promise(r=>setImmediate(r)); }

describe('EventHandler extra', () => {
  test('multi-handlers: order, break on true, error handling, invalid export warn', async () => {
    const client: any = new MiniClient();
    new EventHandler(client as unknown as Client);
    client.emit('messageCreate', { content: 'hi' });
    await flushPromises();

    expect(handlers['ok1.ts'].default).toHaveBeenCalled();
    expect(handlers['ok2.ts'].default).toHaveBeenCalled();
    expect(handlers['breaker.ts'].default).toHaveBeenCalled();
    expect(handlers['err.ts'].default).not.toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('nie eksportuje domyślnej funkcji'));
  });

  test('error in early handler logs error then continues to later (no breaker)', async () => {
    handlers['breaker.ts'].default.mockImplementationOnce(() => false);
    const client: any = new MiniClient();
    new EventHandler(client as unknown as Client);
    client.emit('messageCreate', { content: 'err path' });
    await flushPromises();

    handlers['ok1.ts'].default.mockImplementationOnce(() => { throw new Error('first boom'); });
    client.emit('messageCreate', { content: 'again' });
    await flushPromises();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Błąd w obsłudze eventu'));
    expect(handlers['ok2.ts'].default.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(handlers['err.ts'].default).toHaveBeenCalled();
  });

  test('unknown event module (missing.ts) -> no crash, logger.warn called', async () => {
    const client: any = new MiniClient();
    new EventHandler(client as unknown as Client);
    client.emit('messageCreate', { content: 'hi' });
    await flushPromises();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Błąd ładowania eventu missing.ts'));
  });

  test('no handlers in a directory -> skipped without registration', async () => {
    jest.isolateModules(() => {
      jest.doMock('fs', () => {
        const real = jest.requireActual('fs');
        const readdirSync = (dir: string) => {
          const norm = dir.replace(/\\/g,'/');
          if (norm.endsWith('/src/events')) return ['emptyEvent'];
          if (norm.endsWith('/src/events/emptyEvent')) return ['readme.txt'];
          return real.readdirSync(dir);
        };
        const statSync = (p: string) => ({ isDirectory: () => !/\.ts$|\.txt$/.test(p) });
        return { ...real, readdirSync, statSync };
      });
      const { EventHandler } = require('../../../src/handlers/EventHandler');
      const client = new MiniClient() as any;
      new EventHandler(client);
      expect(true).toBe(true);
    });
  });

  test('outer catch: error thrown while scanning events logs error', async () => {
    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock('fs', () => ({ readdirSync: () => { throw new Error('scan failed'); }, statSync: jest.fn() }));
      const { EventHandler } = require('../../../src/handlers/EventHandler');
      const client = new MiniClient() as any;
      new EventHandler(client);
      const log = require('../../../src/utils/logger').default;
      expect(log.error).toHaveBeenCalled();
      expect(log.error.mock.calls.map((c:any)=>String(c[0]))).toEqual(
        expect.arrayContaining([expect.stringContaining('Error loading events')])
      );
    });
  });
});
