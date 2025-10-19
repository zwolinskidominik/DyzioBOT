export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockErrorEmbed = () => ({ setDescription: jest.fn(function () { return this; }) });
const mockSuccessEmbed = {};

jest.mock('../../../../src/utils/moderationHelpers', () => ({
  __esModule: true,
  createModErrorEmbed: jest.fn(() => mockErrorEmbed()),
  createModSuccessEmbed: jest.fn(() => mockSuccessEmbed),
  findBannedUser: jest.fn(async () => ({ id: 'b1', username: 'banned' })),
}));

describe('commands/moderation/unban', () => {
  const build = (overrides: Record<string, any> = {}) => {
    const reply = jest.fn();
    const deferReply = jest.fn().mockResolvedValue(undefined);
    const editReply = jest.fn().mockResolvedValue(undefined);
    const options = { getString: jest.fn(() => '123') };
    const guild: any = {
      name: 'G',
      bans: { remove: jest.fn().mockResolvedValue(undefined) },
      iconURL: jest.fn(() => 'x'),
    };
    return { reply, deferReply, editReply, options, guild, user: { id: 'req' }, ...overrides } as any;
  };

  test('guild-only', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/unban');
      const i = build({ guild: undefined });
      await run({ interaction: i, client: {} as any });
      expect(i.reply).toHaveBeenCalled();
    });
  });

  test('user not found by findBannedUser', async () => {
    jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.findBannedUser as jest.Mock).mockResolvedValueOnce(null);
      const { run } = await import('../../../../src/commands/moderation/unban');
      const i = build();
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('happy path', async () => {
    jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.findBannedUser as jest.Mock).mockResolvedValueOnce({ id: 'b1', username: 'banned' });
      const { run } = await import('../../../../src/commands/moderation/unban');
      const i = build();
      await run({ interaction: i, client: {} as any });
      expect(i.guild.bans.remove).toHaveBeenCalledWith('123');
      expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
    });
  });

  test('error path', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const { run } = await import('../../../../src/commands/moderation/unban');
      const i = build();
      i.guild.bans.remove.mockRejectedValue(new Error('x'));
      await run({ interaction: i, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(i.editReply).toHaveBeenCalled();
    });
  });
});
