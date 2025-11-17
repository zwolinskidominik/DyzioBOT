export {};

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

jest.mock('../../../../src/models/MonthlyStatsConfig', () => ({
  __esModule: true,
  MonthlyStatsConfigModel: {
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
  editReply.mockImplementationOnce(firstEdit).mockResolvedValue(undefined);

  const interaction: any = {
    deferred: true,
    user: { id: 'u1', tag: 'U#0001' },
    options: { getSubcommand: jest.fn() },
    deferReply,
    editReply,
    guild: buildGuild(guildChannels),
    client: { user: { id: 'bot-id-123' } },
  };
  return { interaction, collector };
};

describe('admin/config-monthly-stats command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('set: confirm without channel selection -> validation message', async () => {
    await jest.isolateModules(async () => {
      const { MonthlyStatsConfigModel } = await import('../../../../src/models/MonthlyStatsConfig');
      (MonthlyStatsConfigModel.findOne as jest.Mock).mockResolvedValue(null);

      const { run } = await import('../../../../src/commands/admin/configMonthlyStats');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const confirmInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isStringSelectMenu: () => false,
        isButton: () => true,
        customId: 'monthly-stats-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(confirmInteraction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Musisz wybrać kanał') })
      );
    });
  });

  test('set: select channel, count, enable, then confirm -> saves config', async () => {
    await jest.isolateModules(async () => {
      const { MonthlyStatsConfigModel } = await import('../../../../src/models/MonthlyStatsConfig');
      (MonthlyStatsConfigModel.findOne as jest.Mock).mockResolvedValue(null);
      (MonthlyStatsConfigModel.findOneAndUpdate as jest.Mock).mockResolvedValue({
        guildId: 'g1',
        channelId: 'ch1',
        enabled: true,
        topCount: 15,
      });

      const { run } = await import('../../../../src/commands/admin/configMonthlyStats');
      const { interaction, collector } = buildInteraction(['ch1']);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });
      const channelSelectInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isStringSelectMenu: () => false,
        isButton: () => false,
        customId: 'monthly-stats-channel-select',
        values: ['ch1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(channelSelectInteraction);
      const countSelectInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isStringSelectMenu: () => true,
        isButton: () => false,
        customId: 'monthly-stats-count-select',
        values: ['15'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(countSelectInteraction);

      const enableInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isStringSelectMenu: () => false,
        isButton: () => true,
        customId: 'monthly-stats-enable',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(enableInteraction);

      const confirmInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isStringSelectMenu: () => false,
        isButton: () => true,
        customId: 'monthly-stats-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(confirmInteraction);

      expect(MonthlyStatsConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'g1' },
        expect.objectContaining({
          guildId: 'g1',
          channelId: 'ch1',
          enabled: true,
          topCount: 15,
        }),
        expect.any(Object)
      );
    });
  });

  test('set: cancel -> shows cancelled message', async () => {
    await jest.isolateModules(async () => {
      const { MonthlyStatsConfigModel } = await import('../../../../src/models/MonthlyStatsConfig');
      (MonthlyStatsConfigModel.findOne as jest.Mock).mockResolvedValue(null);

      const { run } = await import('../../../../src/commands/admin/configMonthlyStats');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const cancelInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isStringSelectMenu: () => false,
        isButton: () => true,
        customId: 'monthly-stats-cancel',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(cancelInteraction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Konfiguracja anulowana.' })
      );
    });
  });

  test('set: timeout -> shows timeout message', async () => {
    await jest.isolateModules(async () => {
      const { MonthlyStatsConfigModel } = await import('../../../../src/models/MonthlyStatsConfig');
      (MonthlyStatsConfigModel.findOne as jest.Mock).mockResolvedValue(null);

      const { run } = await import('../../../../src/commands/admin/configMonthlyStats');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      collector.handlers.end!([], 'time');

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Czas na konfigurację minął') })
      );
    });
  });

  test('remove: no config -> error message', async () => {
    await jest.isolateModules(async () => {
      const { MonthlyStatsConfigModel } = await import('../../../../src/models/MonthlyStatsConfig');
      (MonthlyStatsConfigModel.findOne as jest.Mock).mockResolvedValue(null);

      const { run } = await import('../../../../src/commands/admin/configMonthlyStats');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('remove');

      await run({ interaction, client: {} as any });

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });
  });

  test('remove: existing config -> deletes successfully', async () => {
    await jest.isolateModules(async () => {
      const { MonthlyStatsConfigModel } = await import('../../../../src/models/MonthlyStatsConfig');
      (MonthlyStatsConfigModel.findOne as jest.Mock).mockResolvedValue({
        guildId: 'g1',
        channelId: 'ch1',
        enabled: true,
        topCount: 10,
      });
      (MonthlyStatsConfigModel.findOneAndDelete as jest.Mock).mockResolvedValue({});

      const { run } = await import('../../../../src/commands/admin/configMonthlyStats');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('remove');

      await run({ interaction, client: {} as any });

      expect(MonthlyStatsConfigModel.findOneAndDelete).toHaveBeenCalledWith({ guildId: 'g1' });
    });
  });

  test('show: no config -> error message', async () => {
    await jest.isolateModules(async () => {
      const { MonthlyStatsConfigModel } = await import('../../../../src/models/MonthlyStatsConfig');
      (MonthlyStatsConfigModel.findOne as jest.Mock).mockResolvedValue(null);

      const { run } = await import('../../../../src/commands/admin/configMonthlyStats');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('show');

      await run({ interaction, client: {} as any });

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([expect.any(Object)]),
        })
      );
    });
  });

  test('show: existing config -> displays config', async () => {
    await jest.isolateModules(async () => {
      const { MonthlyStatsConfigModel } = await import('../../../../src/models/MonthlyStatsConfig');
      (MonthlyStatsConfigModel.findOne as jest.Mock).mockResolvedValue({
        guildId: 'g1',
        channelId: 'ch1',
        enabled: true,
        topCount: 10,
      });

      const { run } = await import('../../../../src/commands/admin/configMonthlyStats');
      const { interaction } = buildInteraction(['ch1']);
      interaction.options.getSubcommand.mockReturnValue('show');

      await run({ interaction, client: {} as any });

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([expect.any(Object)]),
        })
      );
    });
  });
});
