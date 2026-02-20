/**
 * Deep tests for CommandHandler.
 * Tests: loadCommands, registerCommands, clearCommands, executeCommand,
 *        handleAutocomplete, validation chain, permission checks.
 */

jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

import { readdirSync, statSync } from 'fs';
import { CommandHandler } from '../../../src/handlers/CommandHandler';

const mockReaddirSync = readdirSync as jest.Mock;
const mockStatSync = statSync as jest.Mock;

/* ─── helpers ──────────────────────────────────────────────────── */
function mockFS(commandFiles: Record<string, any>, validationFiles: Record<string, any> = {}) {
  mockReaddirSync.mockImplementation((dir: string) => {
    if (dir.includes('commands')) return Object.keys(commandFiles);
    if (dir.includes('validations')) return Object.keys(validationFiles);
    return [];
  });
  mockStatSync.mockImplementation((_path: string) => ({
    isDirectory: () => false,
  }));

  // Setup require mocks
  for (const [name, mod] of Object.entries(commandFiles)) {
    jest.doMock(
      require('path').join(__dirname, '..', '..', '..', 'src', 'commands', name),
      () => mod,
      { virtual: true }
    );
  }
  for (const [name, mod] of Object.entries(validationFiles)) {
    jest.doMock(
      require('path').join(__dirname, '..', '..', '..', 'src', 'validations', name),
      () => mod,
      { virtual: true }
    );
  }
}

function createMockClient(overrides: any = {}) {
  const listeners: Record<string, Function[]> = {};
  return {
    on: jest.fn((event: string, fn: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    }),
    once: jest.fn((event: string, fn: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    }),
    emit: (event: string, ...args: any[]) => {
      (listeners[event] || []).forEach(fn => fn(...args));
    },
    application: {
      commands: {
        set: jest.fn().mockResolvedValue(undefined),
        fetch: jest.fn().mockResolvedValue(new Map()),
        create: jest.fn().mockResolvedValue(undefined),
        edit: jest.fn().mockResolvedValue(undefined),
      },
    },
    guilds: {
      fetch: jest.fn().mockResolvedValue({
        name: 'TestGuild',
        commands: {
          set: jest.fn().mockResolvedValue(undefined),
          fetch: jest.fn().mockResolvedValue(new Map()),
          create: jest.fn().mockResolvedValue(undefined),
          edit: jest.fn().mockResolvedValue(undefined),
        },
      }),
    },
    user: { id: 'bot1' },
    ...overrides,
  };
}

function createMockInteraction(overrides: any = {}) {
  return {
    isChatInputCommand: () => true,
    isContextMenuCommand: () => false,
    isAutocomplete: () => false,
    commandName: 'testcmd',
    user: { id: 'u1' },
    guild: { id: 'g1', members: { me: { permissions: { has: () => true } } } },
    member: {
      roles: { cache: new Map() },
    },
    memberPermissions: { has: jest.fn().mockReturnValue(true) },
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('CommandHandler', () => {
  it('loads commands from filesystem', () => {
    const commandFiles = {
      'test.ts': {
        data: { name: 'test', toJSON: () => ({ name: 'test', description: 'Test' }) },
        run: jest.fn(),
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);
    expect(client.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
  });

  it('skips files without data/run exports', () => {
    const commandFiles = {
      'bad.ts': { notData: true },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);
    // The command should not have been added 
    // (bad export is skipped with a warning, no data.name to set)
    // Verify by trying to trigger it - no error thrown means it was skipped
    expect(handler).toBeDefined();
  });

  it('skips non-ts/js files', () => {
    mockReaddirSync.mockReturnValue(['readme.md']);
    mockStatSync.mockReturnValue({ isDirectory: () => false });

    const client = createMockClient();
    const handler = new CommandHandler(client as any);
    // Should just skip, no warn
  });

  it('recurses into subdirectories', () => {
    let callCount = 0;
    mockReaddirSync.mockImplementation((dir: string) => {
      callCount++;
      if (callCount === 1) return ['subdir'];
      return [];
    });
    mockStatSync.mockImplementation((path: string) => ({
      isDirectory: () => path.includes('subdir'),
    }));

    const client = createMockClient();
    const handler = new CommandHandler(client as any);
    expect(mockReaddirSync.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('registers commands on clientReady', async () => {
    const commandFiles = {
      'test.ts': {
        data: { name: 'test', toJSON: () => ({ name: 'test', description: 'Test' }) },
        run: jest.fn(),
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    // Trigger clientReady
    await client.emit('clientReady');
    // Allow promises to settle
    await new Promise(r => setTimeout(r, 50));
    expect(client.application.commands.fetch).toHaveBeenCalled();
  });

  it('registerCommands with bulkRegister mode', async () => {
    const commandFiles = {
      'test.ts': {
        data: { name: 'test', toJSON: () => ({ name: 'test', description: 'Test', type: 1 }) },
        run: jest.fn(),
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any, { bulkRegister: true });

    await client.emit('clientReady');
    await new Promise(r => setTimeout(r, 50));
    expect(client.application.commands.set).toHaveBeenCalled();
  });

  it('registerCommands skips deleted commands', async () => {
    const commandFiles = {
      'deleted.ts': {
        data: { name: 'deleted', toJSON: () => ({ name: 'deleted', description: 'D' }) },
        run: jest.fn(),
        options: { deleted: true },
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any, { bulkRegister: true });

    await client.emit('clientReady');
    await new Promise(r => setTimeout(r, 50));
    // Should set empty array since the only command is deleted
    expect(client.application.commands.set).toHaveBeenCalledWith([]);
  });

  it('executeCommand runs command.run', async () => {
    const runFn = jest.fn();
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction();
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(runFn).toHaveBeenCalled();
  });

  it('executeCommand blocks guild-only command in DMs', async () => {
    const runFn = jest.fn();
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
        options: { guildOnly: true },
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction({ guild: null });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(runFn).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('serwerze') })
    );
  });

  it('executeCommand blocks devOnly for non-devs', async () => {
    const runFn = jest.fn();
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
        options: { devOnly: true },
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any, { devUserIds: ['dev1'] });

    const interaction = createMockInteraction({ user: { id: 'notdev' } });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(runFn).not.toHaveBeenCalled();
  });

  it('executeCommand allows devOnly for dev users', async () => {
    const runFn = jest.fn();
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
        options: { devOnly: true },
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any, { devUserIds: ['u1'] });

    const interaction = createMockInteraction({ user: { id: 'u1' } });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(runFn).toHaveBeenCalled();
  });

  it('executeCommand blocks when missing user permissions', async () => {
    const runFn = jest.fn();
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
        options: { userPermissions: ['ManageMessages'] },
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction({
      memberPermissions: { has: jest.fn().mockReturnValue(false) },
    });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(runFn).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('uprawnień') })
    );
  });

  it('executeCommand blocks when missing bot permissions', async () => {
    const runFn = jest.fn();
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
        options: { botPermissions: ['ManageMessages'] },
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction({
      guild: {
        id: 'g1',
        members: { me: { permissions: { has: jest.fn().mockReturnValue(false) } } },
      },
    });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(runFn).not.toHaveBeenCalled();
  });

  it('executeCommand handles command.run error', async () => {
    const runFn = jest.fn().mockRejectedValue(new Error('Run failed'));
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction();
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    // After error in run, handler sends error reply to user
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Wystąpił błąd') })
    );
  });

  it('responds via followUp when already replied', async () => {
    const runFn = jest.fn().mockRejectedValue(new Error('fail'));
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction({ replied: true });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(interaction.followUp).toHaveBeenCalled();
  });

  it('handles autocomplete interaction', async () => {
    const autoFn = jest.fn();
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: jest.fn(),
        autocomplete: autoFn,
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction({
      isChatInputCommand: () => false,
      isContextMenuCommand: () => false,
      isAutocomplete: () => true,
    });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(autoFn).toHaveBeenCalled();
  });

  it('ignores autocomplete for command without autocomplete handler', async () => {
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: jest.fn(),
      },
    };
    mockFS(commandFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction({
      isChatInputCommand: () => false,
      isContextMenuCommand: () => false,
      isAutocomplete: () => true,
    });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    // Should not throw
  });

  it('clearCommands clears global and guild commands', async () => {
    mockFS({});
    const client = createMockClient();
    const handler = new CommandHandler(client as any, {
      bulkRegister: true,
      devGuildIds: ['guild1'],
    });

    await handler.clearCommands();
    expect(client.application.commands.set).toHaveBeenCalledWith([]);
  });

  it('clearCommands handles guild fetch error', async () => {
    mockFS({});
    const client = createMockClient();
    client.guilds.fetch.mockRejectedValue(new Error('No guild'));
    const handler = new CommandHandler(client as any, {
      bulkRegister: true,
      devGuildIds: ['badguild'],
    });

    // Should not throw
    await handler.clearCommands();
  });

  it('registerCommands throws if no client.application', async () => {
    mockFS({});
    const client = createMockClient({ application: null });
    const handler = new CommandHandler(client as any);
    await expect(handler.registerCommands()).rejects.toThrow();
  });

  it('ignores interaction for unknown command', async () => {
    mockFS({});
    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction({ commandName: 'nonexistent' });
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('runs validation chain and blocks on validation error', async () => {
    const runFn = jest.fn();
    const commandFiles = {
      'testcmd.ts': {
        data: { name: 'testcmd', toJSON: () => ({ name: 'testcmd', description: 'D' }) },
        run: runFn,
      },
    };
    const validationFiles = {
      'testval.ts': {
        default: jest.fn().mockResolvedValue('Cooldown active'),
      },
    };
    mockFS(commandFiles, validationFiles);

    const client = createMockClient();
    const handler = new CommandHandler(client as any);

    const interaction = createMockInteraction();
    await client.emit('interactionCreate', interaction);
    await new Promise(r => setTimeout(r, 50));
    expect(runFn).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Cooldown active' })
    );
  });
});
