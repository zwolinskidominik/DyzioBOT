export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const mockErrorEmbed = () => ({
  setDescription: jest.fn(function (this: any) { return this; }),
});
const mockSuccessEmbed = {};

jest.mock('../../../../src/utils/moderationHelpers', () => ({
  __esModule: true,
  createModErrorEmbed: jest.fn(() => mockErrorEmbed()),
  createModSuccessEmbed: jest.fn(() => mockSuccessEmbed),
  checkModPermissions: jest.fn(() => true),
}));

describe('commands/moderation/ban', () => {
  const buildInteraction = (overrides: Record<string, any> = {}) => {
    const reply = jest.fn();
    const deferReply = jest.fn().mockResolvedValue(undefined);
    const editReply = jest.fn().mockResolvedValue(undefined);
    const member = { roles: { highest: { position: 2 } } } as any;
    const user = { id: 'requester', tag: 'Requester#0001' } as any;
    const options = {
      getUser: jest.fn(() => ({ id: 'target', username: 'Target' } as any)),
      getString: jest.fn(() => 'powod'),
    };
    const guild: any = {
      name: 'TestGuild',
      iconURL: jest.fn(() => 'icon'),
      members: {
        fetch: jest.fn(),
        me: { roles: { highest: { position: 3 } } },
      } as any,
      bans: { remove: jest.fn() } as any,
    };
    return {
      reply,
      deferReply,
      editReply,
      options: options,
      member: member,
      user,
      guild: guild,
      client: { application: { id: 'bot' } },
      ...overrides,
    } as any;
  };

  test('guild-only: replies ephemeral when no guild', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/ban');
      const interaction = buildInteraction({ guild: undefined as any });
      await run({ interaction, client: {} as any });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.any(String), flags: expect.any(Number) })
      );
    });
  });

  test('member fetch failure -> error embed not found', async () => {
    jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as jest.Mock).mockReturnValue(true);
      const { run } = await import('../../../../src/commands/moderation/ban');
      const interaction = buildInteraction();
      (interaction.guild!.members.fetch as any).mockRejectedValue(new Error('nope'));
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
      const errorEmbed = (helpers.createModErrorEmbed as jest.Mock).mock.results[0].value;
      expect(errorEmbed.setDescription).toHaveBeenCalledWith(
        expect.stringContaining('Nie można znaleźć użytkownika')
      );
    });
  });

  test('bot member missing -> error embed about bot permissions', async () => {
    jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/moderation/ban');
      const interaction = buildInteraction();
      (interaction.guild!.members as any).me = null;
      (interaction.guild!.members.fetch as any).mockResolvedValue({} as any);
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  test('checkModPermissions false -> error and return', async () => {
    jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as jest.Mock).mockReturnValue(false);
      const { run } = await import('../../../../src/commands/moderation/ban');
      const interaction = buildInteraction();
      (interaction.guild!.members.fetch as any).mockResolvedValue({} as any);
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  test('happy path -> bans member and replies with success embed', async () => {
    jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as jest.Mock).mockReturnValue(true);
      const { run } = await import('../../../../src/commands/moderation/ban');
      const interaction = buildInteraction();
      (interaction.guild!.members.fetch as any).mockResolvedValue({
        ban: jest.fn().mockResolvedValue(undefined),
      } as any);
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('error during ban -> logs and sends generic error embed', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as jest.Mock).mockReturnValue(true);
      const { run } = await import('../../../../src/commands/moderation/ban');
      const interaction = buildInteraction();
      (interaction.guild!.members.fetch as any).mockResolvedValue({
        ban: jest.fn().mockRejectedValue(new Error('fail')),
      } as any);
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });
});
