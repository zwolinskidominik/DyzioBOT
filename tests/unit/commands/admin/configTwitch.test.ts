export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ __embed: true, addFields: jest.fn(), ...args })),
}));
const StreamConfModel: any = {
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  findOne: jest.fn(),
};

jest.mock('../../../../src/models/StreamConfiguration', () => ({
  __esModule: true,
  StreamConfigurationModel: StreamConfModel,
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  let handlers: Record<string, any> = {};
  const collector = {
    on: jest.fn((event: string, cb: any) => {
      handlers[event] = cb;
      return collector;
    }),
    stop: jest.fn(),
    _handlers: handlers,
  } as any;

  const response = {
    createMessageComponentCollector: jest.fn(() => collector),
  } as any;

  const reply = jest.fn();
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(response);
  const guild = {
    id: 'g1',
    name: 'Guild',
    iconURL: () => 'http://icon',
    channels: { cache: { get: jest.fn() } },
  } as any;
  const options = {
    getSubcommand: jest.fn(() => 'set'),
  };
  const interaction = {
    reply,
    deferReply,
    editReply,
    options,
    guild,
    user: { id: 'u1' },
  } as any;
  return { interaction, response, collector };
};

describe('admin/configTwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('set subcommand', () => {
    test('brak wyboru → komunikat "Musisz wybrać kanał"', async () => {
      await jest.isolateModules(async () => {
        const { interaction, collector } = buildInteraction();
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('set');
        await run({ interaction, client: {} as any });
        const collect = collector._handlers['collect'];
        await collect({
          user: { id: 'u1' },
          customId: 'twitch-confirm',
          isChannelSelectMenu: () => false,
          isButton: () => true,
          deferUpdate: jest.fn().mockResolvedValue(undefined),
        });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ content: expect.stringMatching(/Musisz wybrać kanał\./) })
        );
      });
    });

    test('wybrany kanał nie istnieje → błąd', async () => {
      await jest.isolateModules(async () => {
        const { interaction, collector } = buildInteraction();
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('set');
        await run({ interaction, client: {} as any });
        const collect = collector._handlers['collect'];
        await collect({
          user: { id: 'u1' },
          customId: 'twitch-channel-select',
          isChannelSelectMenu: () => true,
          isButton: () => false,
          values: ['missing'],
          deferUpdate: jest.fn().mockResolvedValue(undefined),
        });
        await collect({
          user: { id: 'u1' },
          customId: 'twitch-confirm',
          isChannelSelectMenu: () => false,
          isButton: () => true,
          deferUpdate: jest.fn().mockResolvedValue(undefined),
        });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ isError: true })] })
        );
        expect(collector.stop).toHaveBeenCalled();
      });
    });

    test('zapis (upsert) OK', async () => {
      await jest.isolateModules(async () => {
        const { interaction, collector } = buildInteraction();
        const { StreamConfigurationModel } = await import('../../../../src/models/StreamConfiguration');
        (StreamConfigurationModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
        const channel = { id: 'text1' };
        interaction.guild.channels.cache.get.mockReturnValue(channel);

        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('set');
        await run({ interaction, client: {} as any });
        const collect = collector._handlers['collect'];
        await collect({
          user: { id: 'u1' },
          customId: 'twitch-channel-select',
          isChannelSelectMenu: () => true,
          isButton: () => false,
          values: ['text1'],
          deferUpdate: jest.fn().mockResolvedValue(undefined),
        });
        await collect({
          user: { id: 'u1' },
          customId: 'twitch-confirm',
          isChannelSelectMenu: () => false,
          isButton: () => true,
          deferUpdate: jest.fn().mockResolvedValue(undefined),
        });
        expect(StreamConfigurationModel.findOneAndUpdate).toHaveBeenCalledWith(
          { guildId: 'g1' },
          { guildId: 'g1', channelId: 'text1' },
          expect.objectContaining({ upsert: true, new: true })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ description: expect.stringMatching(/został skonfigurowany/i) })], components: [] })
        );
      });
    });

    test('zapis (upsert) wyjątek modelu → logger.error', async () => {
      await jest.isolateModules(async () => {
        const { interaction, collector } = buildInteraction();
        const logger = (await import('../../../../src/utils/logger')).default as any;
        const { StreamConfigurationModel } = await import('../../../../src/models/StreamConfiguration');
        (StreamConfigurationModel.findOneAndUpdate as jest.Mock).mockRejectedValue(new Error('db'));
        interaction.guild.channels.cache.get.mockReturnValue({ id: 'text1' });
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('set');
        await run({ interaction, client: {} as any });
        const collect = collector._handlers['collect'];
        await collect({ user: { id: 'u1' }, customId: 'twitch-channel-select', isChannelSelectMenu: () => true, isButton: () => false, values: ['text1'], deferUpdate: jest.fn().mockResolvedValue(undefined) });
        await expect(
          collect({ user: { id: 'u1' }, customId: 'twitch-confirm', isChannelSelectMenu: () => false, isButton: () => true, deferUpdate: jest.fn().mockResolvedValue(undefined) })
        ).rejects.toThrow();
        expect(logger.error).toHaveBeenCalled();
      });
    });

    test('cancel: komunikat anulowania', async () => {
      await jest.isolateModules(async () => {
        const { interaction, collector } = buildInteraction();
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('set');
        await run({ interaction, client: {} as any });
        const collect = collector._handlers['collect'];
        await collect({
          user: { id: 'u1' },
          customId: 'twitch-cancel',
          isChannelSelectMenu: () => false,
          isButton: () => true,
          deferUpdate: jest.fn().mockResolvedValue(undefined),
        });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ content: expect.stringMatching(/Konfiguracja anulowana\./), components: [] })
        );
        expect(collector.stop).toHaveBeenCalled();
      });
    });

    test('timeout collectora: komunikat o czasie', async () => {
      await jest.isolateModules(async () => {
        const { interaction, collector } = buildInteraction();
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('set');
        await run({ interaction, client: {} as any });
        const end = collector._handlers['end'];
        await end([], 'time');
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ content: expect.stringMatching(/Czas na wybór minął/i), components: [] })
        );
      });
    });
  });

  describe('show subcommand', () => {
    test('brak konfiguracji', async () => {
      await jest.isolateModules(async () => {
        const { interaction } = buildInteraction();
        const { StreamConfigurationModel } = await import('../../../../src/models/StreamConfiguration');
        (StreamConfigurationModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('show');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ isError: true })] })
        );
      });
    });

    test('kanał nie istnieje', async () => {
      await jest.isolateModules(async () => {
        const { interaction } = buildInteraction();
        const { StreamConfigurationModel } = await import('../../../../src/models/StreamConfiguration');
        (StreamConfigurationModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve({ guildId: 'g1', channelId: 'missing' }) }) });
        interaction.guild.channels.cache.get.mockReturnValue(undefined);
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('show');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ isError: true })] })
        );
      });
    });

    test('konfiguracja poprawna', async () => {
      await jest.isolateModules(async () => {
        const { interaction } = buildInteraction();
        const { StreamConfigurationModel } = await import('../../../../src/models/StreamConfiguration');
        (StreamConfigurationModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve({ guildId: 'g1', channelId: 'c1' }) }) });
        interaction.guild.channels.cache.get.mockReturnValue({ id: 'c1' });
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('show');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ title: expect.stringMatching(/Konfiguracja kanału powiadomień Twitch/), description: expect.any(String) })] })
        );
      });
    });
  });

  describe('remove subcommand', () => {
    test('brak konfiguracji', async () => {
      await jest.isolateModules(async () => {
        const { interaction } = buildInteraction();
        const { StreamConfigurationModel } = await import('../../../../src/models/StreamConfiguration');
        (StreamConfigurationModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('remove');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ isError: true })] })
        );
      });
    });

    test('poprawne usunięcie', async () => {
      await jest.isolateModules(async () => {
        const { interaction } = buildInteraction();
        const { StreamConfigurationModel } = await import('../../../../src/models/StreamConfiguration');
        (StreamConfigurationModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve({ guildId: 'g1', channelId: 'c1' }) }) });
        (StreamConfigurationModel.findOneAndDelete as jest.Mock).mockResolvedValue({});
        const { run } = await import('../../../../src/commands/admin/configTwitch');
        interaction.options.getSubcommand.mockReturnValue('remove');
        await run({ interaction, client: {} as any });
        expect(StreamConfigurationModel.findOneAndDelete).toHaveBeenCalledWith({ guildId: 'g1' });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.objectContaining({ description: expect.stringMatching(/Usunięto kanał powiadomień Twitch/i) })] })
        );
      });
    });
  });
});
