export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockErrorEmbed = () => ({ setDescription: jest.fn(function () { return this; }) });
const mockSuccessEmbed = { setDescription: jest.fn(function () { return this; }) } as any;

jest.mock('../../../../src/utils/moderationHelpers', () => ({
  __esModule: true,
  createModErrorEmbed: jest.fn(() => mockErrorEmbed()),
  createModSuccessEmbed: jest.fn(() => mockSuccessEmbed),
  formatDuration: jest.fn(async (ms: number) => `${Math.round(ms / 60000)} min`),
}));

describe('commands/moderation/mute', () => {
  const build = (overrides: Record<string, any> = {}) => {
    const reply = jest.fn();
    const deferReply = jest.fn().mockResolvedValue(undefined);
    const editReply = jest.fn().mockResolvedValue(undefined);
    const options = {
      getUser: jest.fn(() => ({ id: 'u1' })),
      getString: jest
        .fn()
        .mockImplementation((name: string) =>
          name === 'czas_trwania' ? '10m' : name === 'powod' ? 'reason' : null
        ),
    };
    const guild: any = {
      name: 'G',
      members: { fetch: jest.fn(), me: { roles: { highest: { position: 3 } } } },
      iconURL: jest.fn(() => 'x'),
    };
    const member = { roles: { highest: { position: 2 } } };
    return { reply, deferReply, editReply, options, guild, member, user: { id: 'req' } as any, ...overrides } as any;
  };

  test('guild-only', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build({ guild: undefined });
      await run({ interaction: i, client: {} as any });
      expect(i.reply).toHaveBeenCalled();
    });
  });

  test('missing user', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      i.options.getUser = jest.fn(() => null);
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('missing duration', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      i.options.getString = jest.fn((name: string) => (name === 'powod' ? 'r' : null));
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('missing reason', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      i.options.getString = jest.fn((name: string) => (name === 'czas_trwania' ? '10m' : null));
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('member fetch failure', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      i.guild.members.fetch.mockRejectedValue(new Error('x'));
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('invalid duration (too small)', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      i.options.getString = jest.fn((name: string) =>
        name === 'czas_trwania' ? '1s' : name === 'powod' ? 'r' : null
      );
      i.guild.members.fetch.mockResolvedValue({ roles: { highest: { position: 1 } }, isCommunicationDisabled: jest.fn(() => false), timeout: jest.fn() });
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.any(String) }));
    });
  });

  test('bot me missing', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      i.guild.members.me = null;
      i.guild.members.fetch.mockResolvedValue({ roles: { highest: { position: 1 } }, isCommunicationDisabled: jest.fn(() => false), timeout: jest.fn() });
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalled();
    });
  });

  test('role position prevents mute', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      i.guild.members.fetch.mockResolvedValue({ roles: { highest: { position: 5 } }, isCommunicationDisabled: jest.fn(() => false), timeout: jest.fn() });
      await run({ interaction: i, client: {} as any });
      expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.any(String) }));
    });
  });

  test('happy path (was not muted)', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      const timeout = jest.fn().mockResolvedValue(undefined);
      i.guild.members.fetch.mockResolvedValue({ roles: { highest: { position: 1 } }, isCommunicationDisabled: jest.fn(() => false), timeout });
      await run({ interaction: i, client: {} as any });
      expect(timeout).toHaveBeenCalled();
      expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
    });
  });

  test('error path', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const { run } = await import('../../../../src/commands/moderation/mute');
      const i = build();
      i.guild.members.fetch.mockResolvedValue({ roles: { highest: { position: 1 } }, isCommunicationDisabled: jest.fn(() => true), timeout: jest.fn().mockRejectedValue(new Error('x')) });
      await run({ interaction: i, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(i.editReply).toHaveBeenCalled();
    });
  });
});
