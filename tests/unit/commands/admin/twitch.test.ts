export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ __embed: true, ...args })),
}));

const ctorMock = jest.fn((payload: any) => ({
  ...payload,
  save: jest.fn().mockResolvedValue(undefined),
}));
(ctorMock as any).findOne = jest.fn();
(ctorMock as any).find = jest.fn();
(ctorMock as any).deleteOne = jest.fn();

jest.mock('../../../../src/models/TwitchStreamer', () => ({
  __esModule: true,
  TwitchStreamerModel: ctorMock,
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn();
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const options = {
    getSubcommand: jest.fn(() => 'add'),
    getString: jest.fn(),
    getUser: jest.fn(),
  };
  const guild = {
    id: 'g1',
    name: 'Guild',
    iconURL: () => 'http://icon',
  } as any;
  return {
    reply,
    deferReply,
    editReply,
    options,
    guild,
    user: { id: 'requester' },
    ...over,
  } as any;
};

describe('admin/twitch command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ctorMock as jest.Mock).mockClear();
    (ctorMock as any).findOne.mockReset();
    (ctorMock as any).find.mockReset();
    (ctorMock as any).deleteOne.mockReset();
  });

  describe('add', () => {
    test('creates a new streamer when not exists', async () => {
      jest.isolateModules(async () => {
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'twitch-nick' ? 'Nick' : null
        );
        interaction.options.getUser.mockImplementation((name: string) =>
          name === 'discord-uzytkownik' ? { id: 'u1', username: 'U' } : null
        );
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(interaction.deferReply).toHaveBeenCalled();
  expect(ctorMock.mock.calls[0][0]).toEqual(
          expect.objectContaining({ guildId: 'g1', twitchChannel: 'Nick', userId: 'u1', active: true })
        );
  const createdDoc = ctorMock.mock.results[0].value;
        expect(createdDoc.save).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });

    test('updates existing streamer (sets channel and active)', async () => {
      jest.isolateModules(async () => {
        const existing: any = { twitchChannel: 'old', active: false, save: jest.fn().mockResolvedValue(undefined) };
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(existing) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'twitch-nick' ? 'NewNick' : null
        );
        interaction.options.getUser.mockImplementation((name: string) =>
          name === 'discord-uzytkownik' ? { id: 'u1' } : null
        );
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(existing.twitchChannel).toBe('NewNick');
        expect(existing.active).toBe(true);
        expect(existing.save).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });

    test('handles save error', async () => {
      jest.isolateModules(async () => {
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
  ctorMock.mockImplementationOnce((payload: any) => ({
          ...payload,
          save: jest.fn().mockRejectedValue(new Error('db')),
        }));
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'twitch-nick' ? 'Nick' : null
        );
        interaction.options.getUser.mockImplementation((name: string) =>
          name === 'discord-uzytkownik' ? { id: 'u1' } : null
        );
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });
  });

  describe('list', () => {
    test('no streamers found', async () => {
      jest.isolateModules(async () => {
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.find as jest.Mock).mockReturnValue({
          lean: () => ({ exec: () => Promise.resolve([]) }),
        });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });

    test('returns list of streamers', async () => {
      jest.isolateModules(async () => {
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.find as jest.Mock).mockReturnValue({
          lean: () => ({ exec: () => Promise.resolve([{ twitchChannel: 'nick', userId: 'u1' }]) }),
        });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });

    test('handles find error', async () => {
      jest.isolateModules(async () => {
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.find as jest.Mock).mockReturnValue({
          lean: () => ({ exec: () => Promise.reject(new Error('db')) }),
        });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });
  });

  describe('remove', () => {
    test('streamer not found', async () => {
      jest.isolateModules(async () => {
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'twitch-nick' ? 'Nick' : null
        );
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: expect.arrayContaining([expect.objectContaining({ isError: true })]) })
        );
      });
    });

    test('deletes existing streamer', async () => {
      jest.isolateModules(async () => {
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({}) });
        (TwitchStreamerModel.deleteOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({}) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'twitch-nick' ? 'Nick' : null
        );
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(TwitchStreamerModel.deleteOne).toHaveBeenCalledWith(
          expect.objectContaining({ guildId: 'g1', twitchChannel: 'Nick' })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });

    test('handles delete error', async () => {
      jest.isolateModules(async () => {
        const { TwitchStreamerModel } = await import('../../../../src/models/TwitchStreamer');
        (TwitchStreamerModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({}) });
        (TwitchStreamerModel.deleteOne as jest.Mock).mockReturnValue({ exec: () => Promise.reject(new Error('db')) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'twitch-nick' ? 'Nick' : null
        );
        const { run } = await import('../../../../src/commands/admin/twitch');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });
  });
});
