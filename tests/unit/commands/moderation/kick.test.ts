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
  checkModPermissions: jest.fn(() => true),
}));

describe('commands/moderation/kick', () => {
  const build = (overrides: Record<string, any> = {}) => {
    const reply = jest.fn();
    const deferReply = jest.fn().mockResolvedValue(undefined);
    const editReply = jest.fn().mockResolvedValue(undefined);
    const options = {
      getUser: jest.fn(() => ({ id: 'u1' })),
      getString: jest.fn(() => 'reason'),
    };
    const guild: any = {
      name: 'G',
      members: { fetch: jest.fn(), me: { roles: { highest: { position: 3 } } } },
    };
    return { reply, deferReply, editReply, options, guild, member: { roles: { highest: { position: 2 } } }, client: { application: { id: 'bot' } }, user: { id: 'req' }, ...overrides } as any;
  };

  test('guild-only', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/kick');
      const i = build({ guild: undefined });
      await run({ interaction: i, client: {} as any });
      expect(i.reply).toHaveBeenCalled();
    });
  });

  test('missing user', async () => {
    jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as jest.Mock).mockReturnValue(true);
      const { run } = await import('../../../../src/commands/moderation/kick');
      const i = build();
      i.options.getUser = jest.fn(() => null);
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('missing reason', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/kick');
      const i = build();
      i.options.getString = jest.fn(() => null);
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('fetch target fails', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/kick');
      const i = build();
      i.guild.members.fetch.mockRejectedValue(new Error('x'));
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('bot me missing', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/kick');
      const i = build();
      i.guild.members.me = null;
      i.guild.members.fetch.mockResolvedValue({} as any);
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('permission denied by checkModPermissions', async () => {
    jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as jest.Mock).mockReturnValue(false);
      const { run } = await import('../../../../src/commands/moderation/kick');
      const i = build();
      i.guild.members.fetch.mockResolvedValue({} as any);
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('happy path', async () => {
    jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as jest.Mock).mockReturnValue(true);
      const { run } = await import('../../../../src/commands/moderation/kick');
      const i = build();
      i.guild.members.fetch.mockResolvedValue({ kick: jest.fn().mockResolvedValue(undefined) });
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.anything()] }));
    });
  });

  test('error path', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as jest.Mock).mockReturnValue(true);
      const { run } = await import('../../../../src/commands/moderation/kick');
      const i = build();
      i.guild.members.fetch.mockResolvedValue({ kick: jest.fn().mockRejectedValue(new Error('x')) });
      await run({ interaction: i, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(i.editReply).toHaveBeenCalled();
    });
  });
});
