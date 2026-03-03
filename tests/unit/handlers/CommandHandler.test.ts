/* ── Mocks ─────────────────────────────────────────── */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock fs to control which files/dirs are returned
const mockReaddirSync = jest.fn();
const mockStatSync = jest.fn();

jest.mock('fs', () => ({
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  statSync: (...args: any[]) => mockStatSync(...args),
}));

// Mock path.join to return predictable paths
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return { ...actual, join: (...parts: string[]) => parts.join('/') };
});

import { mockClient, mockInteraction, mockGuild, mockGuildMember } from '../../helpers/discordMocks';

describe('CommandHandler', () => {
  let CommandHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module registry so CommandHandler re-loads
    jest.resetModules();

    // Re-mock after resetModules
    jest.doMock('../../../src/utils/logger', () => ({
      __esModule: true,
      default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('fs', () => ({
      readdirSync: (...args: any[]) => mockReaddirSync(...args),
      statSync: (...args: any[]) => mockStatSync(...args),
    }));

    // Default: commands dir has one subdirectory 'misc' with one command
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir.includes('commands')) return ['misc'];
      if (dir.includes('misc')) return ['ping.ts'];
      if (dir.includes('validations')) return ['globalCooldown.ts'];
      return [];
    });

    mockStatSync.mockImplementation((path: string) => ({
      isDirectory: () =>
        path.includes('commands/misc') ||
        (path.includes('commands') && !path.endsWith('.ts')),
    }));

    // Commands and validations are loaded via require() by CommandHandler
    // We control what readdirSync returns, and the tested methods
    // (respond, isDeveloper, summarize, commandChanged) don't need real commands.
  });

  it('can be imported', async () => {
    // Simple import test - the constructor tries to load commands/validations via fs
    // We need to bypass the actual file loading
    mockReaddirSync.mockReturnValue([]);
    const mod = await import('../../../src/handlers/CommandHandler');
    expect(mod.CommandHandler).toBeDefined();
    CommandHandler = mod.CommandHandler;
  });

  it('creates instance with client', () => {
    mockReaddirSync.mockReturnValue([]);
    const client = mockClient();
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const handler = new CH(client, {});
    expect(handler).toBeDefined();
    expect(client.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
    expect(client.once).toHaveBeenCalledWith('clientReady', expect.any(Function));
  });

  it('respond method uses reply if not deferred', async () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, {});
    
    // Access the private respond method via prototype
    const interaction = mockInteraction({ replied: false, deferred: false });
    const payload = { content: 'test' };
    await (handler as any).respond(interaction, payload);
    expect(interaction.reply).toHaveBeenCalledWith(payload);
  });

  it('respond method uses followUp if already replied', async () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, {});

    const interaction = mockInteraction({ replied: true, deferred: false });
    const payload = { content: 'test' };
    await (handler as any).respond(interaction, payload);
    expect(interaction.followUp).toHaveBeenCalledWith(payload);
  });

  it('isDeveloper checks devUserIds', () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, { devUserIds: ['dev-1'] });

    const interaction = mockInteraction({ user: { id: 'dev-1' } });
    expect((handler as any).isDeveloper(interaction)).toBe(true);
  });

  it('isDeveloper returns false for non-dev', () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, { devUserIds: ['dev-1'] });

    const interaction = mockInteraction({ user: { id: 'other-user' } });
    expect((handler as any).isDeveloper(interaction)).toBe(false);
  });

  it('isDeveloper checks devRoleIds', () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, { devRoleIds: ['dev-role'] });

    const member = mockGuildMember({ id: 'user-1' });
    member.roles.cache.has = jest.fn().mockReturnValue(true);
    const interaction = mockInteraction({ member });
    expect((handler as any).isDeveloper(interaction)).toBe(true);
  });

  it('summarize produces stable JSON', () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, {});

    const cmd1 = { name: 'test', description: 'desc', type: 1 };
    const cmd2 = { type: 1, name: 'test', description: 'desc' };
    expect((handler as any).summarize(cmd1)).toBe((handler as any).summarize(cmd2));
  });

  it('commandChanged detects differences', () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, {});

    const existing = { name: 'test', description: 'old', type: 1 };
    const next = { name: 'test', description: 'new', type: 1 };
    expect((handler as any).commandChanged(existing, next)).toBe(true);
  });

  it('commandChanged returns false for identical', () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, {});

    const cmd = { name: 'test', description: 'desc', type: 1 };
    expect((handler as any).commandChanged(cmd, { ...cmd })).toBe(false);
  });

  it('commandChanged ignores VS-16 variation selector in descriptions', () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, {});

    const withVS16 = { name: 'kpn', description: 'Graj! \u2702\uFE0F', type: 1 };
    const withoutVS16 = { name: 'kpn', description: 'Graj! \u2702', type: 1 };
    expect((handler as any).commandChanged(withVS16, withoutVS16)).toBe(false);
  });

  it('summarize recurses into subcommand options', () => {
    mockReaddirSync.mockReturnValue([]);
    const { CommandHandler: CH } = require('../../../src/handlers/CommandHandler');
    const client = mockClient();
    const handler = new CH(client, {});

    const cmd1 = {
      name: 'cmd',
      description: 'desc',
      type: 1,
      options: [
        {
          name: 'sub',
          type: 1,
          description: 'sub desc',
          options: [{ name: 'arg', type: 3, description: 'arg desc', required: true }],
        },
      ],
    };
    const cmd2 = {
      name: 'cmd',
      description: 'desc',
      type: 1,
      options: [
        {
          name: 'sub',
          type: 1,
          description: 'sub desc',
          options: [{ name: 'arg', type: 3, description: 'arg desc', required: false }],
        },
      ],
    };
    expect((handler as any).commandChanged(cmd1, cmd2)).toBe(true);
  });
});
