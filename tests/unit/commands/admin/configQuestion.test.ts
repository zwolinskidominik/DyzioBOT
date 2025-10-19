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

jest.mock('../../../../src/models/QuestionConfiguration', () => ({
  __esModule: true,
  QuestionConfigurationModel: {
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

const buildGuild = (channelIds: string[] = [], roleIds: string[] = []) => {
  const channelsMap = new Map<string, any>();
  channelIds.forEach((id) => channelsMap.set(id, { id }));
  const rolesMap = new Map<string, any>();
  roleIds.forEach((id) => rolesMap.set(id, { id }));
  return {
    id: 'g1',
    name: 'Guild',
    iconURL: jest.fn(() => 'http://icon'),
    channels: { cache: channelsMap },
    roles: { cache: rolesMap },
  } as any;
};

const buildInteraction = (guildChannels: string[] = [], guildRoles: string[] = []) => {
  const editReply = jest.fn();
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const collector = createCollector();
  const fetchReply = jest
    .fn()
    .mockResolvedValue({ createMessageComponentCollector: jest.fn(() => collector) });

  const interaction: any = {
    deferred: true,
    user: { id: 'u1', tag: 'U#0001' },
    options: { getSubcommand: jest.fn() },
    deferReply,
    editReply,
    fetchReply,
    guild: buildGuild(guildChannels, guildRoles),
  };
  return { interaction, collector };
};

describe('admin/config-questions command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('set: flow with channel then role then confirm -> saves and embed', async () => {
    await jest.isolateModules(async () => {
      const { QuestionConfigurationModel } = await import(
        '../../../../src/models/QuestionConfiguration'
      );
      (QuestionConfigurationModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction, collector } = buildInteraction(['c1'], ['r1']);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      // simulate channel select
      const selectChannel: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isRoleSelectMenu: () => false,
        isButton: () => false,
        customId: 'questions-channel-select',
        values: ['c1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectChannel);

      // simulate role select
      const selectRole: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => true,
        isButton: () => false,
        customId: 'questions-role-select',
        values: ['r1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectRole);

      // confirm
      const confirm: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'questions-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(confirm);

      expect(QuestionConfigurationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: interaction.guild.id },
        { guildId: interaction.guild.id, questionChannelId: 'c1', pingRoleId: 'r1' },
        { upsert: true, new: true }
      );
      expect(interaction.editReply).toHaveBeenLastCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)], components: [] })
      );
    });
  });

  test('set: skip role -> saves with no role', async () => {
    await jest.isolateModules(async () => {
      const { QuestionConfigurationModel } = await import(
        '../../../../src/models/QuestionConfiguration'
      );
      (QuestionConfigurationModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction, collector } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const selectChannel: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isRoleSelectMenu: () => false,
        isButton: () => false,
        customId: 'questions-channel-select',
        values: ['c1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectChannel);

      const skipRoleBtn: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'questions-skip-role',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(skipRoleBtn);

      const confirm: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'questions-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(confirm);

      expect(QuestionConfigurationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: interaction.guild.id },
        { guildId: interaction.guild.id, questionChannelId: 'c1', pingRoleId: undefined },
        { upsert: true, new: true }
      );
    });
  });

  test('set: interaction from another user -> ephemeral denial', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction, collector } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const foreignCollect: any = {
        user: { id: 'other' },
        isChannelSelectMenu: () => true,
        isRoleSelectMenu: () => false,
        isButton: () => false,
        customId: 'questions-channel-select',
        values: ['c1'],
        reply: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(foreignCollect);

      expect(foreignCollect.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Tylko osoba, która uruchomiła komendę'),
          flags: expect.any(Number),
        })
      );
    });
  });

  test('set: selected channel not found in guild -> error embed and stop', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction, collector } = buildInteraction([]);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const selectChannel: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isRoleSelectMenu: () => false,
        isButton: () => false,
        customId: 'questions-channel-select',
        values: ['cX'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectChannel);

      const skipToConfirm: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'questions-skip-role',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(skipToConfirm);

      const confirm: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'questions-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(confirm);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('set: cancel -> configuration cancelled', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction, collector } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('set');
      await run({ interaction, client: {} as any });

      const cancelBtn: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'questions-cancel',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(cancelBtn);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Konfiguracja anulowana.', components: [] })
      );
    });
  });

  test('set: collector timeout -> informs user', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction, collector } = buildInteraction(['c1']);
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
      const { QuestionConfigurationModel } = await import(
        '../../../../src/models/QuestionConfiguration'
      );
      (QuestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const { run } = await import('../../../../src/commands/admin/configQuestion');
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
      const { QuestionConfigurationModel } = await import(
        '../../../../src/models/QuestionConfiguration'
      );
      (QuestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ questionChannelId: 'c1' }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('remove');
      await run({ interaction, client: {} as any });
      expect(QuestionConfigurationModel.findOneAndDelete).toHaveBeenCalledWith({
        guildId: interaction.guild.id,
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('show: no config -> error embed', async () => {
    await jest.isolateModules(async () => {
      const { QuestionConfigurationModel } = await import(
        '../../../../src/models/QuestionConfiguration'
      );
      (QuestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const { run } = await import('../../../../src/commands/admin/configQuestion');
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
      const { QuestionConfigurationModel } = await import(
        '../../../../src/models/QuestionConfiguration'
      );
      (QuestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ questionChannelId: 'cX' }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction } = buildInteraction([]);
      interaction.options.getSubcommand.mockReturnValue('show');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('show: ping role configured but missing -> embed still sent with info', async () => {
    await jest.isolateModules(async () => {
      const { QuestionConfigurationModel } = await import(
        '../../../../src/models/QuestionConfiguration'
      );
      (QuestionConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () =>
          ({ exec: () => Promise.resolve({ questionChannelId: 'c1', pingRoleId: 'rX' }) }) as any,
      });
      const { run } = await import('../../../../src/commands/admin/configQuestion');
      const { interaction } = buildInteraction(['c1'], []);
      interaction.options.getSubcommand.mockReturnValue('show');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });
});
