export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ __embed: true, addFields: jest.fn(), ...args })),
}));

// Mock model with constructor and statics
const TempConfCtor: any = jest.fn(function (this: any, payload: any) {
  Object.assign(this, payload);
  this.save = jest.fn().mockResolvedValue(undefined);
});
TempConfCtor.findOne = jest.fn();
TempConfCtor.find = jest.fn();
TempConfCtor.findOneAndDelete = jest.fn();

jest.mock('../../../../src/models/TempChannelConfiguration', () => ({
  __esModule: true,
  TempChannelConfigurationModel: TempConfCtor,
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const options = {
    getSubcommand: jest.fn(() => 'add'),
    getChannel: jest.fn(),
  };
  const guild = {
    id: 'g1',
    channels: { cache: { get: jest.fn() } },
  } as any;
  return { reply, options, guild, ...over } as any;
};

describe('admin/tempChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('add', () => {
    test('duplikat → ephem komunikat', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({ _id: 'x' }) });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getChannel.mockReturnValue({ id: 'v1', name: 'VC' });
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/już dodany/i) }));
      });
    });

    test('happy path', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getChannel.mockReturnValue({ id: 'v2', name: 'Voice2' });
        await run({ interaction, client: {} as any });
        const created = (TempConfCtor as jest.Mock).mock.instances[0] as any;
        expect(created.guildId).toBe('g1');
        expect(created.channelId).toBe('v2');
        expect(created.save).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/został dodany/i) }));
      });
    });

    test('save rzuca → ephem błąd', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
        // Make constructor instance reject on save
        (TempConfCtor as jest.Mock).mockImplementationOnce(function (this: any, payload: any) {
          Object.assign(this, payload);
          this.save = jest.fn().mockRejectedValue(new Error('db'));
        });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getChannel.mockReturnValue({ id: 'v3', name: 'Voice3' });
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/Wystąpił błąd podczas dodawania kanału/i) }));
      });
    });
  });

  describe('list', () => {
    test('pusta lista → ephem komunikat', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.find as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([]) }) });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/Brak monitorowanych kanałów/i) }));
      });
    });

    test('lista z nazwą', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.find as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([{ channelId: 'v1' }]) }) });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        interaction.guild.channels.cache.get.mockReturnValue({ id: 'v1', name: 'Name1' });
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      });
    });

    test('lista z “niedostępny” gdy brak w cache', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.find as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([{ channelId: 'missing' }]) }) });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        interaction.guild.channels.cache.get.mockReturnValue(undefined);
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      });
    });
  });

  describe('remove', () => {
    test('brak wpisu → ephem komunikat', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.findOneAndDelete as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getChannel.mockReturnValue({ id: 'v9', name: 'Voice9' });
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/nie był monitorowany/i) }));
      });
    });

    test('happy path', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.findOneAndDelete as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({}) });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getChannel.mockReturnValue({ id: 'v8', name: 'Voice8' });
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/został usunięty/i) }));
      });
    });

    test('DB wyjątek → ephem błąd', async () => {
      await jest.isolateModules(async () => {
        const { TempChannelConfigurationModel } = await import('../../../../src/models/TempChannelConfiguration');
        (TempChannelConfigurationModel.findOneAndDelete as jest.Mock).mockReturnValue({ exec: () => Promise.reject(new Error('db')) });
        const { run } = await import('../../../../src/commands/admin/tempChannel');
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getChannel.mockReturnValue({ id: 'v7', name: 'Voice7' });
        await run({ interaction, client: {} as any });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/Wystąpił błąd podczas usuwania kanału/i) }));
      });
    });
  });
});
