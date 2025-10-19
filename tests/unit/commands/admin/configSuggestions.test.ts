export {};

// Mocks
jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn(() => {
    const embed: any = { addFields: jest.fn() };
    return embed;
  }),
}));

jest.mock('../../../../src/models/SuggestionConfiguration', () => ({
  __esModule: true,
  SuggestionConfigurationModel: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

type Collector = {
  on: (event: 'collect' | 'end', handler: Function) => void;
  stop: (reason?: string) => void;
  handlers: { collect?: Function; end?: Function };
};

const createCollector = (): Collector => {
  const handlers: any = {};
  return {
    handlers,
    on: (event, handler) => {
      handlers[event] = handler;
    },
    stop: (reason?: string) => {
      if (handlers.end) handlers.end([], reason ?? 'manual');
    },
  } as Collector;
};

const buildGuild = (channelIds: string[] = []) => {
  const channelsMap = new Map<string, any>();
  channelIds.forEach((id) => channelsMap.set(id, { id }));
  return {
    id: 'g1',
    name: 'Guild',
    iconURL: jest.fn(() => 'http://icon'),
    channels: { cache: channelsMap },
  } as any;
};

const buildInteraction = (guildChannels: string[] = []) => {
  const editReply = jest.fn();
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const collector = createCollector();
  const firstEdit = jest
    .fn()
    .mockResolvedValue({ createMessageComponentCollector: jest.fn(() => collector) });
  // For set subcommand, first editReply returns the response with collector; others resolve normally
  editReply.mockImplementationOnce(firstEdit).mockResolvedValue(undefined);

  const interaction: any = {
    deferred: true,
    user: { id: 'u1', tag: 'U#0001' },
    options: { getSubcommand: jest.fn() },
    deferReply,
    editReply,
    guild: buildGuild(guildChannels),
  };
  return { interaction, collector };
};

describe('admin/config-suggestions command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('set: confirm without selection -> validation message', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const confirmInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isButton: () => true,
        customId: 'suggestions-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(confirmInteraction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Musisz wybrać kanał.' })
      );
    });
  });

  test('set: selected channel not found -> error embed and stop', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction, collector } = buildInteraction([]);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const selectInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isButton: () => false,
        customId: 'suggestions-channel-select',
        values: ['c-missing'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectInteraction);

      const confirmInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isButton: () => true,
        customId: 'suggestions-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(confirmInteraction);

      // error embed
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('set: happy path -> saves and shows embed', async () => {
    await jest.isolateModules(async () => {
      const { SuggestionConfigurationModel } = await import(
        '../../../../src/models/SuggestionConfiguration'
      );
      (SuggestionConfigurationModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction, collector } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const selectInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isButton: () => false,
        customId: 'suggestions-channel-select',
        values: ['c1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectInteraction);

      const confirmInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isButton: () => true,
        customId: 'suggestions-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(confirmInteraction);

      expect(SuggestionConfigurationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: interaction.guild.id },
        { guildId: interaction.guild.id, suggestionChannelId: 'c1' },
        { upsert: true, new: true }
      );
      expect(interaction.editReply).toHaveBeenLastCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)], components: [] })
      );
    });
  });

  test('set: collector timeout -> informs user', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');
      await run({ interaction, client: {} as any });
      await collector.handlers.end!([], 'time');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Czas na wybór minął. Spróbuj ponownie.', components: [] })
      );
    });
  });

  test('remove: no config -> error embed', async () => {
    await jest.isolateModules(async () => {
      const { SuggestionConfigurationModel } = await import(
        '../../../../src/models/SuggestionConfiguration'
      );
      (SuggestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('remove');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('remove: config exists -> delete and success embed', async () => {
    await jest.isolateModules(async () => {
      const { SuggestionConfigurationModel } = await import(
        '../../../../src/models/SuggestionConfiguration'
      );
      (SuggestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ suggestionChannelId: 'c1' }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('remove');
      await run({ interaction, client: {} as any });
      expect(SuggestionConfigurationModel.findOneAndDelete).toHaveBeenCalledWith({
        guildId: interaction.guild.id,
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('show: no config -> error embed', async () => {
    await jest.isolateModules(async () => {
      const { SuggestionConfigurationModel } = await import(
        '../../../../src/models/SuggestionConfiguration'
      );
      (SuggestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('show');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('show: configured channel missing -> error embed', async () => {
    await jest.isolateModules(async () => {
      const { SuggestionConfigurationModel } = await import(
        '../../../../src/models/SuggestionConfiguration'
      );
      (SuggestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ suggestionChannelId: 'cX' }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction } = buildInteraction([]);
      interaction.options.getSubcommand.mockReturnValue('show');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('show: config exists -> embed', async () => {
    await jest.isolateModules(async () => {
      const { SuggestionConfigurationModel } = await import(
        '../../../../src/models/SuggestionConfiguration'
      );
      (SuggestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ suggestionChannelId: 'c1' }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configSuggestions');
      const { interaction } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('show');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });
});
