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

jest.mock('../../../../src/models/AutoRole', () => ({
  __esModule: true,
  AutoRoleModel: {
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

const buildGuild = (roleIds: string[] = []) => {
  const rolesMap = new Map<string, any>();
  roleIds.forEach((id) => rolesMap.set(id, { id }));
  return {
    id: 'g1',
    name: 'Guild',
    iconURL: jest.fn(() => 'http://icon'),
    roles: { cache: rolesMap },
  } as any;
};

const buildInteraction = (over: Record<string, any> = {}) => {
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
    options: { getSubcommand: jest.fn(), getString: jest.fn(), getInteger: jest.fn(), getRole: jest.fn() },
    deferReply,
    editReply,
    guild: buildGuild(['rBot', 'rUser1', 'rUser2']),
  };
  return { interaction, collector };
};

describe('admin/config-autorole command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('set: confirm with no selection -> validation error', async () => {
    await jest.isolateModules(async () => {
      const { AutoRoleModel } = await import('../../../../src/models/AutoRole');
      const { run } = await import('../../../../src/commands/admin/configAutorole');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const confirmInteraction: any = {
        user: { id: interaction.user.id },
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'autorole-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
  await collector.handlers.collect!(confirmInteraction);

      expect(AutoRoleModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Musisz wybrać co najmniej jedną rolę.') })
      );
    });
  });

  test('set: select roles then confirm -> saves config and shows embed', async () => {
    await jest.isolateModules(async () => {
      const { AutoRoleModel } = await import('../../../../src/models/AutoRole');
      (AutoRoleModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      const { run } = await import('../../../../src/commands/admin/configAutorole');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');

      await run({ interaction, client: {} as any });

      const selectInteraction: any = {
        user: { id: interaction.user.id },
        isRoleSelectMenu: () => true,
        isButton: () => false,
        customId: 'autorole-select',
        values: ['rBot', 'rUser1', 'rUser2'],
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
  await collector.handlers.collect!(selectInteraction);

      const confirmInteraction: any = {
        user: { id: interaction.user.id },
        isRoleSelectMenu: () => false,
        isButton: () => true,
        customId: 'autorole-confirm',
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      };
  await collector.handlers.collect!(confirmInteraction);

      expect(AutoRoleModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: interaction.guild.id },
        { guildId: interaction.guild.id, roleIds: ['rBot', 'rUser1', 'rUser2'] },
        { upsert: true }
      );
      expect(interaction.editReply).toHaveBeenLastCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)], components: [] })
      );
    });
  });

  test('show: no config -> info message', async () => {
    await jest.isolateModules(async () => {
      const { AutoRoleModel } = await import('../../../../src/models/AutoRole');
      (AutoRoleModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
      const { run } = await import('../../../../src/commands/admin/configAutorole');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('show');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('❌ Nie skonfigurowano żadnych automatycznych ról.')
      );
    });
  });

  test('show: config exists -> embed', async () => {
    await jest.isolateModules(async () => {
      const { AutoRoleModel } = await import('../../../../src/models/AutoRole');
      (AutoRoleModel.findOne as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ roleIds: ['rBot', 'rUser1'] }) }),
      });
      const { run } = await import('../../../../src/commands/admin/configAutorole');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('show');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('remove: deletes config and replies', async () => {
    await jest.isolateModules(async () => {
      const { AutoRoleModel } = await import('../../../../src/models/AutoRole');
      (AutoRoleModel.deleteOne as jest.Mock).mockResolvedValue({});
      const { run } = await import('../../../../src/commands/admin/configAutorole');
      const { interaction } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('remove');
      await run({ interaction, client: {} as any });
      expect(AutoRoleModel.deleteOne).toHaveBeenCalledWith({ guildId: interaction.guild.id });
      expect(interaction.editReply).toHaveBeenCalledWith(
        '✅ Wszystkie automatyczne role zostały usunięte.'
      );
    });
  });

  test('set: collector timeout -> informs user', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/configAutorole');
      const { interaction, collector } = buildInteraction();
      interaction.options.getSubcommand.mockReturnValue('set');
      await run({ interaction, client: {} as any });
  await collector.handlers.end!([], 'time');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Czas na wybór minął. Spróbuj ponownie.', components: [] })
      );
    });
  });
});
