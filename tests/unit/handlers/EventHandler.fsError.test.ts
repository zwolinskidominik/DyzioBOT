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

function mockFsThrow() {
  jest.doMock('fs', () => ({
    readdirSync: (_p: string) => { throw new Error('fs boom'); },
    statSync: (_p: string) => ({ isDirectory: () => true }),
  }));
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

describe('EventHandler loadEvents error branch', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('logs error when reading events directory throws', async () => {
    mockFsThrow();
    const { EventHandler } = require('../../../src/handlers/EventHandler');
    const logger = require('../../../src/utils/logger').default as { error: jest.Mock };
    const { client } = makeClient();
    new EventHandler(client);
    await new Promise((r) => setImmediate(r));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error loading events'));
  });
});
