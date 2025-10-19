export {};

// Mocks
jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn(() => {
  const embed: any = { addFields: jest.fn(function (this: any) { return this; }) };
    return embed;
  }),
}));

jest.mock('../../../../src/models/BirthdayConfiguration', () => ({
  __esModule: true,
  BirthdayConfigurationModel: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
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

const buildInteraction = (guildChannels: string[] = [], roleIds: string[] = []) => {
  const editReply = jest.fn();
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const collector = createCollector();
  const collector2 = createCollector();
  let collectorCount = 0;
  const mockResponse = { 
    createMessageComponentCollector: jest.fn(() => {
      collectorCount++;
      return collectorCount === 1 ? collector : collector2;
    })
  };
  // editReply should always return an object with createMessageComponentCollector
  editReply.mockResolvedValue(mockResponse);

  const interaction: any = {
    deferred: true,
    user: { id: 'u1', tag: 'U#0001' },
    options: { getSubcommand: jest.fn() },
    deferReply,
    editReply,
    guild: buildGuild(guildChannels, roleIds),
  };
  return { interaction, collector, collector2 };
};

describe('admin/config-birthday command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('set: shows channel selection interface', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ 
          content: '**Krok 1/2:** Wybierz kanał, na który bot będzie wysyłał życzenia urodzinowe:',
          components: expect.any(Array)
        })
      );
    });
  });

  test('set: selected channel not found -> error embed and stop', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction, collector } = buildInteraction([]);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      // Step 1: Select non-existent channel
      const selectInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isButton: () => false,
        customId: 'birthday-channel-select',
        values: ['c-missing'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectInteraction);

      // Step 2: Try to proceed to role setup
      const stepRoleInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-step-role',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(stepRoleInteraction);

      // Should show error embed for missing channel
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('set: happy path -> saves and shows embed', async () => {
    await jest.isolateModules(async () => {
      const { BirthdayConfigurationModel } = await import(
        '../../../../src/models/BirthdayConfiguration'
      );
      (BirthdayConfigurationModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction, collector, collector2 } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      // Step 1: Select channel
      const selectInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isButton: () => false,
        customId: 'birthday-channel-select',
        values: ['c1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectInteraction);

      // Step 2: Go to role setup
      const stepRoleInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-step-role',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(stepRoleInteraction);

      // Step 3: Choose no role (using second collector)
      const noRoleInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-role-remove',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector2.handlers.collect!(noRoleInteraction);

      // Step 4: Confirm configuration
      const confirmInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector2.handlers.collect!(confirmInteraction);

      // First call should unset roleId
      expect(BirthdayConfigurationModel.findOneAndUpdate).toHaveBeenNthCalledWith(1,
        { guildId: interaction.guild.id },
        { $unset: { roleId: 1 } }
      );
      // Second call should save the configuration
      expect(BirthdayConfigurationModel.findOneAndUpdate).toHaveBeenNthCalledWith(2,
        { guildId: interaction.guild.id },
        { guildId: interaction.guild.id, birthdayChannelId: 'c1' },
        { upsert: true, new: true }
      );
      expect(interaction.editReply).toHaveBeenLastCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)], components: [] })
      );
    });
  });

  test('set: collector timeout -> informs user', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configBirthday');
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
      const { BirthdayConfigurationModel } = await import(
        '../../../../src/models/BirthdayConfiguration'
      );
      (BirthdayConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const { run } = await import('../../../../src/commands/admin/configBirthday');
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
      const { BirthdayConfigurationModel } = await import(
        '../../../../src/models/BirthdayConfiguration'
      );
      (BirthdayConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ birthdayChannelId: 'c1' }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('remove');
      await run({ interaction, client: {} as any });
      expect(BirthdayConfigurationModel.deleteOne).toHaveBeenCalledWith({
        guildId: interaction.guild.id,
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('show: no config -> error embed', async () => {
    await jest.isolateModules(async () => {
      const { BirthdayConfigurationModel } = await import(
        '../../../../src/models/BirthdayConfiguration'
      );
      (BirthdayConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      const { run } = await import('../../../../src/commands/admin/configBirthday');
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
      const { BirthdayConfigurationModel } = await import(
        '../../../../src/models/BirthdayConfiguration'
      );
      (BirthdayConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ birthdayChannelId: 'cX' }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configBirthday');
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
      const { BirthdayConfigurationModel } = await import(
        '../../../../src/models/BirthdayConfiguration'
      );
      (BirthdayConfigurationModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ birthdayChannelId: 'c1' }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('show');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('set: role step collector timeout -> informs user', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction, collector, collector2 } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      // Proceed to role step
      const selectInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isButton: () => false,
        customId: 'birthday-channel-select',
        values: ['c1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(selectInteraction);
      const stepRoleInteraction: any = {
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-step-role',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
      await collector.handlers.collect!(stepRoleInteraction);

      // Timeout on second collector
      await collector2.handlers.end!([], 'time');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Czas na wybór minął. Spróbuj ponownie.', components: [] })
      );
    });
  });

  test('set: cancel at role step -> shows cancelled and stops', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction, collector, collector2 } = buildInteraction(['c1']);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      // Go to role step
      await collector.handlers.collect!({
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isButton: () => false,
        values: ['c1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      });
      await collector.handlers.collect!({
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-step-role',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      });

      // Cancel at role step
      await collector2.handlers.collect!({
        user: { id: interaction.user.id },
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-cancel',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      });

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Konfiguracja anulowana.', components: [] })
      );
    });
  });

  test('set: confirm with selected missing role -> replies with error embed', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction, collector, collector2 } = buildInteraction(['c1'], /*roleIds*/ []);
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      // Enter role step
      await collector.handlers.collect!({
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => true,
        isButton: () => false,
        values: ['c1'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      });
      await collector.handlers.collect!({
        user: { id: interaction.user.id },
        isChannelSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-step-role',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      });

      // Select a role that doesn't exist and confirm
      await collector2.handlers.collect!({
        user: { id: interaction.user.id },
        isRoleSelectMenu: () => true,
        isButton: () => false,
        values: ['r-missing'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      });
      await collector2.handlers.collect!({
        user: { id: interaction.user.id },
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'birthday-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      });

      // Should have replied with an error embed for missing role
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('run: missing guild -> replies with error (guard)', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');
      const editReply = interaction.editReply;
      interaction.guild = null;
      await run({ interaction, client: {} as any });
      expect(editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
    });
  });

  test('run: catch block logs and replies error if editReply throws inside handlers', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const { run } = await import('../../../../src/commands/admin/configBirthday');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');
      // Make deferReply succeed but editReply reject to trigger outer catch reply
      interaction.editReply.mockRejectedValueOnce(new Error('fail to edit'));
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      // The outer catch reply will attempt to editReply with error embed as well
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });
});
