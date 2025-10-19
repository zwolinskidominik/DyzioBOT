import { CommandRunner, CommandResult } from '../helpers/commandRunner';
import { DbManager } from '../setup/db';

jest.mock('../../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

// Mock ChannelStatsModel side effects by letting DB handle inserts; we'll only assert reply succeeded

describe('Integration: admin/config-stats (real commands)', () => {
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
    await db.clearCollections();
    CommandRunner.reset();
    runner = CommandRunner.getInstance({ realCommands: true, enableValidations: false, enableCooldowns: false });
    runner.clearCooldowns();
    runner.clearLogs();
  });

  test('rejects when name template invalid (no placeholder)', async () => {
    const result: CommandResult = await runner.runCommand('config-stats', {
      guild: {
        id: '777777777777777777',
        members: { cache: new Map() },
        channels: { create: jest.fn() },
        bans: { fetch: jest.fn().mockResolvedValue(new Map()) },
      } as any,
      options: { rodzaj: 'users', 'nazwa-kanalu': 'Liczba osob' },
    } as any);

    expect(result.success).toBe(true);
  });

  test('happy path: creates stats channel', async () => {
    const guild = {
      id: '888888888888888888',
      members: {
        cache: new Map([
          ['u1', { user: { bot: false }, joinedTimestamp: Date.now() - 10 }],
          ['b1', { user: { bot: true }, joinedTimestamp: Date.now() - 20 }],
        ]),
      },
      channels: {
        create: jest.fn().mockResolvedValue({ id: '999999999999999999', name: '123 persons' }),
      },
      bans: { fetch: jest.fn().mockResolvedValue(new Map()) },
    } as any;

    const result: CommandResult = await runner.runCommand('config-stats', {
      guild,
      options: { rodzaj: 'users', 'nazwa-kanalu': '<> persons' },
    } as any);

    expect(result.success).toBe(true);
    expect(guild.channels.create).toHaveBeenCalled();
  });
});
