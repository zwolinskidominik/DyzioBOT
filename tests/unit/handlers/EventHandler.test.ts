import path from 'path';
import type { Client } from 'discord.js';

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
let logger: { error: jest.Mock; warn: jest.Mock };

function mockFs(structure: Record<string, string[]>) {
  const eventsDir = path.join(process.cwd(), 'src', 'events');
  const dirSet = new Set(Object.keys(structure).map((d) => path.join(eventsDir, d)));
  const readdirSync = jest.fn((p: string) => {
    if (p === eventsDir) return Object.keys(structure);
    const match = Object.entries(structure).find(([name]) => path.join(eventsDir, name) === p);
    if (match) return match[1];
    return [];
  });
  const statSync = jest.fn((p: string) => ({
    isDirectory: () => dirSet.has(p),
  }));
  jest.doMock('fs', () => ({
    readdirSync,
    statSync,
  }));
  return { eventsDir, readdirSync, statSync };
}

function makeClient() {
  const handlers: Record<string, Function[]> = {};
  const client: Partial<Client> = {
    on: jest.fn((event: string, fn: any) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(fn);
      return client as any;
    }),
  };
  return { client: client as Client, handlers };
}

function mockEventModule(fullPath: string, impl: any) {
  jest.doMock(fullPath, () => impl, { virtual: true });
}

describe('EventHandler integration (filesystem + multi handlers)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  logger = require('../../../src/utils/logger').default;
  });

  test('loads handlers, filters files, preserves order, breaks on true', async () => {
    const structure = {
      ready: ['a.ts', 'b.ts', 'c.ts'],
      messageCreate: ['ignored.txt', 'handler.js', 'bad.d.ts', 'map.js.map', 'nofunc.ts'],
      emptyDir: [],
    };
    const { eventsDir } = mockFs(structure);

    const executed: string[] = [];
    mockEventModule(path.join(eventsDir, 'ready', 'a.ts'), { default: () => { executed.push('a'); } });
    mockEventModule(path.join(eventsDir, 'ready', 'b.ts'), { default: () => { executed.push('b'); return true; } });
    mockEventModule(path.join(eventsDir, 'ready', 'c.ts'), { default: () => { executed.push('c'); } });

    mockEventModule(path.join(eventsDir, 'messageCreate', 'handler.js'), { default: () => { executed.push('mc'); } });
    mockEventModule(path.join(eventsDir, 'messageCreate', 'nofunc.ts'), { something: 123 });

  const { client, handlers } = makeClient();
  const { EventHandler } = require('../../../src/handlers/EventHandler');
  new EventHandler(client);
  const mockLogger = require('../../../src/utils/logger').default as { warn: jest.Mock; error: jest.Mock };

    expect(Object.keys(handlers).sort()).toEqual(['messageCreate', 'ready']);
    expect(handlers.ready).toHaveLength(1);
    expect(handlers.messageCreate).toHaveLength(1);

    await handlers.ready[0]();
    expect(executed).toEqual(['a', 'b']);

    await handlers.messageCreate[0]({} as any);
    expect(executed).toContain('mc');

  expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('nie eksportuje'));
  expect(mockLogger.error).not.toHaveBeenCalled();
  });
});

describe('EventHandler error resilience (continues after handler throws)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('continues executing remaining handlers when one throws', async () => {
    const structure = { ready: ['one.ts', 'two.ts'] };
    const { eventsDir } = mockFs(structure);
    const executed: string[] = [];

    mockEventModule(path.join(eventsDir, 'ready', 'one.ts'), { default: () => { executed.push('one'); throw new Error('fail'); } });
    mockEventModule(path.join(eventsDir, 'ready', 'two.ts'), { default: () => { executed.push('two'); } });

  const { client, handlers } = makeClient();
  const { EventHandler } = require('../../../src/handlers/EventHandler');
  new EventHandler(client);
  const mockLogger = require('../../../src/utils/logger').default as { warn: jest.Mock; error: jest.Mock };

    expect(handlers.ready).toHaveLength(1);
    await handlers.ready[0]();
    expect(executed).toEqual(['one', 'two']);
  expect(mockLogger.error).toHaveBeenCalled();
  });
});
