export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ __embed: true, setTimestamp: jest.fn().mockReturnThis(), addFields: jest.fn(), ...args })),
}));

const TicketCfgModel: any = {
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
};

jest.mock('../../../../src/models/TicketConfig', () => ({
  __esModule: true,
  TicketConfigModel: TicketCfgModel,
}));

// Mock AttachmentBuilder to avoid fs usage
jest.mock('discord.js', () => {
  const actual = jest.requireActual('discord.js');
  class AttachmentBuilder { constructor(public path: string) {} }
  // Mock TextChannel instanceof and shape
  function MockTextChannel(this: any) {}
  Object.defineProperty(MockTextChannel, Symbol.hasInstance, { value: (obj: any) => !!obj.__isTextChannel });
  return { ...actual, AttachmentBuilder, TextChannel: MockTextChannel };
});

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const channel = { __isTextChannel: true, send: jest.fn().mockResolvedValue(undefined), parentId: 'cat1' } as any;
  const guild = { id: 'g1', name: 'Guild', iconURL: () => 'http://icon' } as any;
  return { reply, deferReply, editReply, channel, guild, ...over } as any;
};

describe('admin/setupTicket', () => {
  beforeEach(() => jest.clearAllMocks());

  test('brak categoryId na kanale → editReply z komunikatem', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/setupTicket');
      const interaction = buildInteraction({ channel: { __isTextChannel: true, send: jest.fn(), parentId: null } });
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/nie należy do żadnej kategorii/i) }));
    });
  });

  test('zapis i odczyt konfiguracji: happy path', async () => {
    await jest.isolateModules(async () => {
      const { TicketConfigModel } = await import('../../../../src/models/TicketConfig');
      (TicketConfigModel.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({}) });
      (TicketConfigModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve({ guildId: 'g1', categoryId: 'cat1' }) }) });
      const { run } = await import('../../../../src/commands/admin/setupTicket');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(TicketConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'g1' },
        { categoryId: 'cat1' },
        expect.objectContaining({ upsert: true, new: true })
      );
      // Sent message includes embed, row and files
      expect(interaction.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)], components: [expect.any(Object)], files: [expect.any(Object)] })
      );
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/pomyślnie skonfigurowany/i) }));
    });
  });

  test('wyjątek modelu podczas zapisu → błąd + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const { TicketConfigModel } = await import('../../../../src/models/TicketConfig');
      (TicketConfigModel.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: () => Promise.reject(new Error('db')) });
      const { run } = await import('../../../../src/commands/admin/setupTicket');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/Wystąpił błąd/i) }));
    });
  });

  test('wyjątek modelu podczas odczytu → błąd + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const { TicketConfigModel } = await import('../../../../src/models/TicketConfig');
      (TicketConfigModel.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({}) });
      (TicketConfigModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
      const { run } = await import('../../../../src/commands/admin/setupTicket');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/Wystąpił błąd/i) }));
    });
  });
});
