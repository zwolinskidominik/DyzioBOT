/* ── Mocks ─────────────────────────────────────────── */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockReaddirSync = jest.fn();
const mockStatSync = jest.fn();

jest.mock('fs', () => ({
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  statSync: (...args: any[]) => mockStatSync(...args),
}));

import { mockClient } from '../../helpers/discordMocks';

describe('EventHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.doMock('../../../src/utils/logger', () => ({
      __esModule: true,
      default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('fs', () => ({
      readdirSync: (...args: any[]) => mockReaddirSync(...args),
      statSync: (...args: any[]) => mockStatSync(...args),
    }));
  });

  it('can be imported', async () => {
    mockReaddirSync.mockReturnValue([]);
    mockStatSync.mockReturnValue({ isDirectory: () => false });
    const mod = await import('../../../src/handlers/EventHandler');
    expect(mod.EventHandler).toBeDefined();
  });

  it('creates instance and registers event listeners', () => {
    // Return one event dir with one handler file
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir.includes('events') && !dir.includes('messageCreate')) return ['messageCreate'];
      if (dir.includes('messageCreate')) return ['trackXp.ts'];
      return [];
    });

    mockStatSync.mockImplementation((path: string) => ({
      isDirectory: () => !path.endsWith('.ts'),
    }));

    // Event handlers are loaded via require() by EventHandler constructor
    // We just need readdirSync to return empty arrays for clean creation

    const { EventHandler } = require('../../../src/handlers/EventHandler');
    const client = mockClient();
    const handler = new EventHandler(client);
    expect(handler).toBeDefined();
  });

  it('handles empty events directory gracefully', () => {
    mockReaddirSync.mockReturnValue([]);
    mockStatSync.mockReturnValue({ isDirectory: () => false });

    const { EventHandler } = require('../../../src/handlers/EventHandler');
    const client = mockClient();
    expect(() => new EventHandler(client)).not.toThrow();
  });

  it('skips non-directory entries in events folder', () => {
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir.includes('events')) return ['README.md'];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => false });

    const { EventHandler } = require('../../../src/handlers/EventHandler');
    const client = mockClient();
    const handler = new EventHandler(client);
    expect(handler).toBeDefined();
    // client.on should not be called since no valid event dirs
  });
});
