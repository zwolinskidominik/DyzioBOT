export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ __embed: true, ...args })),
}));
jest.mock('discord.js', () => {
  const actual = jest.requireActual('discord.js');
  function MockTextChannel(this: any) {}
  Object.defineProperty(MockTextChannel, Symbol.hasInstance, {
    value: (obj: any) => !!(obj && obj.__isTextChannel === true),
  });
  return { ...actual, TextChannel: MockTextChannel };
});

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const followUp = jest.fn().mockResolvedValue(undefined);
  const showModal = jest.fn().mockResolvedValue(undefined);
  const awaitModalSubmit = jest.fn();
  const interaction = {
    reply,
    followUp,
    showModal,
    awaitModalSubmit,
    channel: undefined,
  } as any;
  return Object.assign(interaction, over);
};

const buildModalSubmit = (message: string, embedMode: string | undefined, channel: any) => {
  const fields = {
    getTextInputValue: jest.fn((id: string) => {
      if (id === 'sayMessage') return message;
      if (id === 'embedMode') return embedMode as any;
      return '';
    }),
  };
  return {
    fields,
    reply: jest.fn().mockResolvedValue(undefined),
  } as any;
};

describe('admin/say', () => {
  beforeEach(() => jest.clearAllMocks());

  test('kanał nie-tekstowy → ephem błąd', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/say');
      const interaction = buildInteraction({ channel: { /* not a TextChannel instance */ } });
      await run({ interaction, client: {} as any });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringMatching(/tylko na kanale tekstowym/i) })
      );
    });
  });

  test('modal submit: embedMode on → wysyłka embeda', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/say');
      const channel = { __isTextChannel: true, send: jest.fn().mockResolvedValue(undefined) } as any;
      const interaction = buildInteraction({ channel });
      const modalResp = buildModalSubmit('hello', 'on', channel);
      interaction.awaitModalSubmit.mockResolvedValue(modalResp);
      await run({ interaction, client: {} as any });
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
      expect(modalResp.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringMatching(/została wysłana/i) })
      );
    });
  });

  test('modal submit: embedMode off → zwykły tekst', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/say');
      const channel = { __isTextChannel: true, send: jest.fn().mockResolvedValue(undefined) } as any;
      const interaction = buildInteraction({ channel });
      const modalResp = buildModalSubmit('plain message', 'off', channel);
      interaction.awaitModalSubmit.mockResolvedValue(modalResp);
      await run({ interaction, client: {} as any });
      expect(channel.send).toHaveBeenCalledWith('plain message');
      expect(modalResp.reply).toHaveBeenCalled();
    });
  });

  test('awaitModalSubmit timeout/wyjątek → followUp ephem', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/say');
      const interaction = buildInteraction({ channel: { __isTextChannel: true, send: jest.fn() } });
      interaction.awaitModalSubmit.mockRejectedValue(new Error('timeout'));
      await run({ interaction, client: {} as any });
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringMatching(/Nie udało się wysłać wiadomości/i) })
      );
    });
  });
});
