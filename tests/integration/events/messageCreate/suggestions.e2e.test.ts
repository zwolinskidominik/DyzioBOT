import { Client, ChannelType, TextChannel } from 'discord.js';
import { createEventHarness, resetEventHarness, EventHarness } from '../../discord/eventHarness';
import { setupDatabase, cleanDatabase, teardownDatabase } from '../../setup/db';
import logger from '../../../../src/utils/logger';
import createSuggestions from '../../../../src/events/messageCreate/createSuggestions';
import { SuggestionConfigurationModel } from '../../../../src/models/SuggestionConfiguration';
import { SuggestionModel } from '../../../../src/models/Suggestion';

// Helpers to build minimal message/channel mocks
function createMockTextChannel(id: string) {
  const sent: any[] = [];
  const channel: any = {
    id,
    type: ChannelType.GuildText,
    send: jest.fn(async (payload: any) => {
      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const msg: any = {
        id: messageId,
        content: typeof payload === 'string' ? payload : payload.content ?? '',
        channel,
        edit: jest.fn(async (newPayload: any) => {
          msg.content = typeof newPayload === 'string' ? newPayload : newPayload.content ?? '';
          msg.embeds = newPayload.embeds;
          msg.components = newPayload.components;
          return msg;
        }),
      };
      sent.push(msg);
      return msg;
    }),
    threads: {
      create: jest.fn().mockResolvedValue({ id: `${id}-thread` }),
    } as any,
  };
  return { channel: channel as TextChannel, sent };
}

function createMockMessage(opts: {
  guildId: string;
  channel: TextChannel;
  authorId?: string;
  authorBot?: boolean;
  content?: string;
}) {
  const { guildId, channel, authorId = 'user-1', authorBot = false, content = 'Moja propozycja' } = opts;
  const msg: any = {
    id: `m-${Math.random().toString(36).slice(2)}`,
    content,
    channel,
    channelId: channel.id,
    guild: { id: guildId },
    author: {
      id: authorId,
      bot: authorBot,
      username: 'Tester',
      displayAvatarURL: () => 'https://example.com/avatar.png',
    },
    client: { user: { id: '1248419676740915310' } }, // test bot id used by getBotConfig fallback
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return msg as any;
}

describe('messageCreate: suggestions (E2E)', () => {
  let harness: EventHarness;
  let client: Client;

  beforeAll(async () => {
    await setupDatabase();
  }, 30000);

  afterAll(async () => {
    await teardownDatabase();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase();
    resetEventHarness();
    harness = createEventHarness();
    client = new Client({ intents: [] });
    harness.setClient(client);

    // Wire up our specific event handler under test
    client.on('messageCreate', async (message) => {
      await createSuggestions(message as any);
    });

  // Winston's leveled methods return Logger; make mocks return the logger instance to satisfy types
  jest.spyOn(logger, 'warn').mockImplementation(((..._args: unknown[]) => logger) as any);
  jest.spyOn(logger, 'error').mockImplementation(((..._args: unknown[]) => logger) as any);
  jest.spyOn(logger, 'info').mockImplementation(((..._args: unknown[]) => logger) as any);
  });

  afterEach(async () => {
    client.removeAllListeners();
    jest.restoreAllMocks();
  });

  it('brak config → brak akcji (cicho ignoruj)', async () => {
    const { channel } = createMockTextChannel('chan-1');
    const message = createMockMessage({ guildId: 'guild-1', channel });

    const findSpy = jest
      .spyOn(SuggestionConfigurationModel, 'findOne')
      .mockResolvedValueOnce(null as any);

    await harness.emitMessageCreate(message as any);
    await new Promise((r) => setTimeout(r, 25));

    // Nie powinno być żadnego ostrzeżenia - po prostu cicho ignoruj
    expect(logger.warn).not.toHaveBeenCalled();
    // No suggestion created
    expect(await SuggestionModel.countDocuments()).toBe(0);

    findSpy.mockRestore();
  });

  it('poprawna konfiguracja → zapis Suggestion + potwierdzenie', async () => {
    const { channel, sent } = createMockTextChannel('suggest-chan');
    await SuggestionConfigurationModel.create({ guildId: 'guild-1', suggestionChannelId: 'suggest-chan' });

    const message = createMockMessage({ guildId: 'guild-1', channel, content: 'To jest super pomysł' });

  await harness.emitMessageCreate(message as any);
  await new Promise((r) => setTimeout(r, 25));

    // Original message deleted
    expect((message as any).delete).toHaveBeenCalled();

    // A confirmation/edit flow happened
    expect(sent.length).toBe(1);
    const createdMsg = sent[0];
    expect(createdMsg.edit).toHaveBeenCalled();

    // DB record created
    const suggestions = await SuggestionModel.find();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].content).toBe('To jest super pomysł');
  });

  it('autor jest bot → ignoruj', async () => {
    const { channel } = createMockTextChannel('suggest-chan');
    await SuggestionConfigurationModel.create({ guildId: 'guild-1', suggestionChannelId: 'suggest-chan' });

    const message = createMockMessage({ guildId: 'guild-1', channel, authorBot: true });

  await harness.emitMessageCreate(message as any);
  await new Promise((r) => setTimeout(r, 25));

    expect(await SuggestionModel.countDocuments()).toBe(0);
  });

  it('exception przy insert → log error, brak crasha', async () => {
    const { channel } = createMockTextChannel('suggest-chan');
    await SuggestionConfigurationModel.create({ guildId: 'guild-1', suggestionChannelId: 'suggest-chan' });

    const message = createMockMessage({ guildId: 'guild-1', channel, content: 'Zepsuj insert' });

    // Force create() to throw
    const createSpy = jest.spyOn(SuggestionModel, 'create').mockRejectedValueOnce(new Error('DB down'));

  await harness.emitMessageCreate(message as any);
  await new Promise((r) => setTimeout(r, 25));

    expect(createSpy).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas tworzenia sugestii'));
    // Ensure no unhandled crash and no record persisted
    expect(await SuggestionModel.countDocuments()).toBe(0);
  });
});
