export {};

// Common mocks
jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ __embed: true, ...args })),
}));

jest.mock('../../../../src/config/bot', () => ({
  __esModule: true,
  getBotConfig: jest.fn(() => ({ emojis: { giveaway: { join: '🎟️', list: '📄' } } })),
}));

jest.mock('../../../../src/models/Giveaway', () => ({
  __esModule: true,
  GiveawayModel: {
    create: jest.fn(),
    deleteOne: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('../../../../src/utils/giveawayHelpers', () => ({
  __esModule: true,
  pickWinners: jest.fn(async () => [{ id: 'w1', username: 'Winner1' }]),
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn();
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const channel = {
    id: 'chan1',
    send: jest.fn().mockResolvedValue({ id: 'msg1' }),
  };
  const textChannel = {
    id: 'chan1',
    messages: {
      fetch: jest.fn(),
    },
    send: jest.fn().mockResolvedValue({}),
  };
  const guild = {
    id: 'g1',
    channels: { cache: new Map([['chan1', textChannel]]) },
  } as any;
  const options = {
    getSubcommand: jest.fn(() => 'create'),
    getString: jest.fn(),
    getInteger: jest.fn(),
    getRole: jest.fn(),
  };
  const user = { id: 'uReq', tag: 'Req#0001' };
  return {
    deferred: false,
    reply,
    deferReply,
    editReply,
    options,
    channel,
    guild,
    user,
    client: { application: { id: 'bot' } },
    ...over,
  } as any;
};

describe('admin/giveaway command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('happy path', async () => {
      jest.isolateModules(async () => {
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.create as jest.Mock).mockResolvedValue({});
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('create');
        interaction.options.getString.mockImplementation((name: string) => {
          if (name === 'nagroda') return 'Prize';
          if (name === 'opis') return 'Desc';
          if (name === 'czas_trwania') return '1 day';
          return null;
        });
        interaction.options.getInteger.mockImplementation((name: string) =>
          name === 'liczba_wygranych' ? 2 : name === 'mnoznik' ? null : null
        );
        interaction.options.getRole.mockReturnValue(null);
        interaction.channel.send = jest.fn().mockResolvedValue({ id: 'msg1' });
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.channel.send).toHaveBeenCalled();
        expect(GiveawayModel.create).toHaveBeenCalledWith(expect.objectContaining({
          giveawayId: expect.any(String),
          messageId: 'msg1',
          prize: 'Prize',
          winnersCount: 2,
          active: true,
        }));
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });

    test('invalid duration -> validation message', async () => {
      jest.isolateModules(async () => {
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('create');
        interaction.options.getString.mockImplementation((name: string) => {
          if (name === 'nagroda') return 'Prize';
          if (name === 'opis') return 'Desc';
          if (name === 'czas_trwania') return 'abc';
          return null;
        });
        interaction.options.getInteger.mockImplementation((name: string) =>
          name === 'liczba_wygranych' ? 1 : null
        );
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.stringContaining('Podaj poprawny czas trwania giveawayu')
        );
      });
    });

  test('model.create throws -> run catch generic error', async () => {
      jest.isolateModules(async () => {
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.create as jest.Mock).mockRejectedValue(new Error('dbfail'));
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('create');
        interaction.options.getString.mockImplementation((name: string) => {
          if (name === 'nagroda') return 'Prize';
          if (name === 'opis') return 'Desc';
          if (name === 'czas_trwania') return '1 day';
          return null;
        });
        interaction.options.getInteger.mockImplementation((name: string) =>
          name === 'liczba_wygranych' ? 1 : null
        );
        interaction.channel.send = jest.fn().mockResolvedValue({ id: 'msg1' });
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        // run() catches and replies with generic error when interaction is not marked as deferred in our mock
        expect(interaction.reply).toHaveBeenCalledWith(
          expect.objectContaining({ content: expect.stringContaining('Wystąpił błąd') })
        );
      });
    });
  });

  describe('edit', () => {
    test('no values provided -> validation message', async () => {
      jest.isolateModules(async () => {
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({}) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('edit');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'id' ? 'gid' : null
        );
        interaction.options.getInteger.mockReturnValue(null);
        interaction.options.getRole.mockReturnValue(null);
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.stringContaining('Nie podałeś żadnych wartości')
        );
      });
    });

    test('giveaway not found', async () => {
      jest.isolateModules(async () => {
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('edit');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'id' ? 'gid' : null
        );
        // Provide one change so it doesn't short-circuit
        interaction.options.getString.mockImplementationOnce((n: string) => (n === 'id' ? 'gid' : null));
        interaction.options.getString.mockImplementationOnce((n: string) => (n === 'nagroda' ? 'X' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.stringContaining('nie został znaleziony')
        );
      });
    });

    test('invalid new duration', async () => {
      jest.isolateModules(async () => {
        const giveaway: any = { endTime: new Date(), save: jest.fn() };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(giveaway) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('edit');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'id' ? 'gid' : name === 'czas_trwania' ? 'zzz' : null
        );
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.stringContaining('Podaj poprawny czas trwania giveawayu')
        );
      });
    });

    test('happy path (with message edit)', async () => {
      jest.isolateModules(async () => {
        const message = { edit: jest.fn().mockResolvedValue(undefined) };
        const channel = {
          id: 'chan1',
          messages: { fetch: jest.fn().mockResolvedValue(message) },
        };
        const giveaway: any = {
          giveawayId: 'gid',
          channelId: 'chan1',
          messageId: 'msg1',
          endTime: new Date(),
          description: 'd',
          prize: 'p',
          winnersCount: 1,
          hostId: 'h',
          save: jest.fn().mockResolvedValue(undefined),
        };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(giveaway) });
        const interaction = buildInteraction({
          guild: { id: 'g1', channels: { cache: new Map([['chan1', channel]]) } },
        });
        interaction.options.getSubcommand.mockReturnValue('edit');
        interaction.options.getString.mockImplementation((name: string) =>
          name === 'id' ? 'gid' : name === 'nagroda' ? 'New' : null
        );
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(message.edit).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });
  });

  describe('remove', () => {
    test('not found', async () => {
      jest.isolateModules(async () => {
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.stringContaining('nie został znaleziony')
        );
      });
    });

    test('happy path (delete message and db)', async () => {
      jest.isolateModules(async () => {
        const message = { delete: jest.fn().mockResolvedValue(undefined) };
        const channel = {
          id: 'chan1',
          messages: { fetch: jest.fn().mockResolvedValue(message) },
        };
        const giveaway = { giveawayId: 'gid', channelId: 'chan1', messageId: 'msg1' };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(giveaway) }) });
        (GiveawayModel.deleteOne as jest.Mock).mockResolvedValue({});
        const interaction = buildInteraction({
          guild: { id: 'g1', channels: { cache: new Map([['chan1', channel]]) } },
        });
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(message.delete).toHaveBeenCalled();
        expect(GiveawayModel.deleteOne).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
          expect.objectContaining({ embeds: [expect.any(Object)] })
        );
      });
    });
  });

  describe('end', () => {
    test('not found', async () => {
      jest.isolateModules(async () => {
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('end');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('nie został znaleziony'));
      });
    });

    test('already inactive', async () => {
      jest.isolateModules(async () => {
        const giveaway: any = { active: false };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(giveaway) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('end');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('został już zakończony'));
      });
    });

    test('channel not found', async () => {
      jest.isolateModules(async () => {
        const giveaway: any = {
          active: true,
          finalized: false,
          save: jest.fn(),
          channelId: 'missing',
        };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(giveaway) });
        const interaction = buildInteraction({ guild: { id: 'g1', channels: { cache: new Map() } } });
        interaction.options.getSubcommand.mockReturnValue('end');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Nie znaleziono kanału'));
      });
    });

    test('message fetch fails', async () => {
      jest.isolateModules(async () => {
        const channel = { messages: { fetch: jest.fn().mockRejectedValue(new Error('x')) } };
        const giveaway: any = {
          active: true,
          finalized: false,
          save: jest.fn(),
          channelId: 'chan1',
          messageId: 'm1',
        };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(giveaway) });
        const interaction = buildInteraction({ guild: { id: 'g1', channels: { cache: new Map([['chan1', channel]]) } } });
        interaction.options.getSubcommand.mockReturnValue('end');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Nie udało się pobrać wiadomości'));
      });
    });

    test('happy path with pickWinners integration', async () => {
      jest.isolateModules(async () => {
        const message = { edit: jest.fn().mockResolvedValue(undefined), reply: jest.fn().mockResolvedValue(undefined) };
        const channel = { messages: { fetch: jest.fn().mockResolvedValue(message) }, send: jest.fn() };
        const giveaway: any = {
          active: true,
          finalized: false,
          save: jest.fn(),
          channelId: 'chan1',
          messageId: 'm1',
          participants: ['a', 'b'],
          winnersCount: 1,
          prize: 'P',
          description: 'D',
          hostId: 'h',
          endTime: new Date(),
          giveawayId: 'gid',
        };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        const { pickWinners } = await import('../../../../src/utils/giveawayHelpers');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(giveaway) });
        (pickWinners as jest.Mock).mockResolvedValue([{ id: 'w1', username: 'W' }]);
        const interaction = buildInteraction({ guild: { id: 'g1', channels: { cache: new Map([['chan1', channel]]) } } });
        interaction.options.getSubcommand.mockReturnValue('end');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(message.edit).toHaveBeenCalled();
        expect(message.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('<@w1>') }));
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      });
    });
  });

  describe('list', () => {
    test('no active giveaways', async () => {
      jest.isolateModules(async () => {
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Brak aktywnych giveawayów'));
      });
    });

    test('happy path', async () => {
      jest.isolateModules(async () => {
        const giveaways = [
          { giveawayId: '1', prize: 'A', description: 'd', winnersCount: 1, endTime: new Date(Date.now() + 1000), participants: [] },
          { giveawayId: '2', prize: 'B', description: 'd', winnersCount: 2, endTime: new Date(Date.now() + 2000), participants: ['x'] },
        ];
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(giveaways) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('list');
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      });
    });
  });

  describe('reroll', () => {
    test('not found', async () => {
      jest.isolateModules(async () => {
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('reroll');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('nie został znaleziony'));
      });
    });

    test('active giveaway -> cannot reroll', async () => {
      jest.isolateModules(async () => {
        const giveaway = { active: true };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(giveaway) }) });
        const interaction = buildInteraction();
        interaction.options.getSubcommand.mockReturnValue('reroll');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('musi być zakończony'));
      });
    });

    test('channel not found', async () => {
      jest.isolateModules(async () => {
        const giveaway: any = { active: false, channelId: 'missing' };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(giveaway) }) });
        const interaction = buildInteraction({ guild: { id: 'g1', channels: { cache: new Map() } } });
        interaction.options.getSubcommand.mockReturnValue('reroll');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Nie znaleziono kanału'));
      });
    });

    test('message fetch fails', async () => {
      jest.isolateModules(async () => {
        const channel = { messages: { fetch: jest.fn().mockRejectedValue(new Error('x')) } };
        const giveaway: any = { active: false, channelId: 'chan1', messageId: 'm', participants: ['a'], winnersCount: 1, prize: 'P', description: 'D', hostId: 'h', endTime: new Date(), giveawayId: 'gid' };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(giveaway) }) });
        const interaction = buildInteraction({ guild: { id: 'g1', channels: { cache: new Map([['chan1', channel]]) } } });
        interaction.options.getSubcommand.mockReturnValue('reroll');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Nie można pobrać wiadomości'));
      });
    });

    test('no participants', async () => {
      jest.isolateModules(async () => {
        const message = { edit: jest.fn(), reply: jest.fn() };
        const channel = { messages: { fetch: jest.fn().mockResolvedValue(message) } };
        const giveaway: any = { active: false, channelId: 'chan1', messageId: 'm', participants: [], winnersCount: 1, prize: 'P', description: 'D', hostId: 'h', endTime: new Date(), giveawayId: 'gid' };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(giveaway) }) });
        const interaction = buildInteraction({ guild: { id: 'g1', channels: { cache: new Map([['chan1', channel]]) } } });
        interaction.options.getSubcommand.mockReturnValue('reroll');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Brak uczestników'));
      });
    });

    test('happy path with pickWinners integration', async () => {
      jest.isolateModules(async () => {
        const message = { edit: jest.fn().mockResolvedValue(undefined), reply: jest.fn().mockResolvedValue(undefined) };
        const channel = { messages: { fetch: jest.fn().mockResolvedValue(message) }, send: jest.fn() };
        const giveaway: any = { active: false, channelId: 'chan1', messageId: 'm', participants: ['a','b'], winnersCount: 1, prize: 'P', description: 'D', hostId: 'h', endTime: new Date(), giveawayId: 'gid' };
        const { GiveawayModel } = await import('../../../../src/models/Giveaway');
        const { pickWinners } = await import('../../../../src/utils/giveawayHelpers');
        (GiveawayModel.findOne as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(giveaway) }) });
        (pickWinners as jest.Mock).mockResolvedValue([{ id: 'w2', username: 'W2' }]);
        const interaction = buildInteraction({ guild: { id: 'g1', channels: { cache: new Map([['chan1', channel]]) } } });
        interaction.options.getSubcommand.mockReturnValue('reroll');
        interaction.options.getString.mockImplementation((name: string) => (name === 'id' ? 'gid' : null));
        const { run } = await import('../../../../src/commands/admin/giveaway');
        await run({ interaction, client: {} as any });
        expect(message.edit).toHaveBeenCalled();
        expect(message.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('<@w2>') }));
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      });
    });
  });
});
