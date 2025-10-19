import { CommandRunner, CommandResult } from '../helpers/commandRunner';
import { DbManager } from '../setup/db';

jest.mock('../../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

describe('Integration: misc/serverinfo (real commands)', () => {
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

  test('replies with server info', async () => {
    const now = Date.now();
    const result: CommandResult = await runner.runCommand('serverinfo', {
      guild: {
        id: '555555555555555555',
        name: 'GuildName',
        ownerId: '111',
        createdTimestamp: now - 10000,
        memberCount: 123,
        roles: { cache: new Map([['r', {}]]) },
        emojis: { cache: new Map([['e', {}]]) },
        premiumSubscriptionCount: 0,
        verificationLevel: 1,
        iconURL: () => 'https://example.com/icon.png',
      } as any,
      member: { joinedAt: new Date(now - 5000) } as any,
    } as any);

    expect(result.success).toBe(true);
    expect(result.replied).toBe(true);
  });
});
