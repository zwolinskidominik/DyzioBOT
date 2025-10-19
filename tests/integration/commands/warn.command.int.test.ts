import { CommandRunner, CommandResult } from '../helpers/commandRunner';
import { DbManager } from '../setup/db';

// Minimal logger mock to reduce noise
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

// Ensure real discord.js is used here (some unit tests mock it)
jest.unmock('discord.js');

// Ensure deterministic guild/user IDs
const GUILD_ID = '111111111111111111';
const TARGET_ID = '222222222222222222';

// Mock Discord fetch member and permissions shape through runner options

describe('Integration: moderation/warn (real commands)', () => {
  jest.setTimeout(20000);
  let db: DbManager;
  let runner: CommandRunner;

  beforeAll(async () => {
    db = new DbManager();
    await db.startDb();
  });

  afterAll(async () => {
    await db.stopDb();
  });

  beforeEach(async () => {
    jest.unmock('discord.js');
    await db.clearCollections();
    CommandRunner.reset();
    runner = CommandRunner.getInstance({ realCommands: true, enableValidations: false, enableCooldowns: false });
    runner.clearCooldowns();
    runner.clearLogs();
    // Preload warn command module to ensure Jest transforms it
    await import('../../../src/commands/moderation/warn');
  });

  test('happy path: warns a member', async () => {
    // Build guild and members with roles hierarchy
    const guild: any = { id: GUILD_ID };
    const targetMember: any = {
      id: TARGET_ID,
      guild,
      roles: { highest: { position: 1 } },
      user: { id: TARGET_ID, tag: 'target#0001' },
      timeout: jest.fn().mockResolvedValue(undefined),
    };
    const botMember: any = { id: 'bot123', guild, roles: { highest: { position: 100 } } };

    guild.members = {
      fetch: jest.fn().mockResolvedValue(targetMember),
      me: botMember,
    };

    const requestMember: any = { id: '333333333333333333', roles: { highest: { position: 50 } }, guild };

    const result: CommandResult = await runner.runCommand('warn', {
      guild,
      options: { uzytkownik: { id: TARGET_ID, tag: 'target#0001' }, powod: 'Test reason' },
      member: requestMember,
    } as any);

    if (!result.success) {
      // Debug on failure
      // eslint-disable-next-line no-console
      console.error('warn happy-path result:', {
        error: result.error?.message,
        logs: result.logs,
      });
    }
    expect(result.success).toBe(true);
    expect(result.replied || result.deferred).toBeTruthy();
  });

  test('no permissions: edit reply with error', async () => {
    const guild: any = { id: GUILD_ID };
    const targetMember: any = {
      id: TARGET_ID,
      guild,
      roles: { highest: { position: 100 } }, // equal/higher than requester to fail
      user: { id: TARGET_ID, tag: 'target#0001' },
      timeout: jest.fn().mockResolvedValue(undefined),
    };
    guild.members = {
      fetch: jest.fn().mockResolvedValue(targetMember),
      me: { id: 'bot123', guild, roles: { highest: { position: 100 } } },
    };
    const requestMember: any = { id: '333333333333333333', roles: { highest: { position: 50 } }, guild };

    const result: CommandResult = await runner.runCommand('warn', {
      guild,
      options: { uzytkownik: { id: TARGET_ID, tag: 'target#0001' }, powod: 'Test reason' },
      member: requestMember,
    } as any);

    // Komenda powinna złagodnieć błąd (editReply), runner -> success true (brak rzucenia wyjątku)
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error('warn no-perms result:', {
        error: result.error?.message,
        logs: result.logs,
      });
    }
    expect(result.success).toBe(true);
  });
});
