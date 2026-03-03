/**
 * Tests for /clear command – bulk message deletion.
 */

/* ── Mocks ───────────────────────────────────────────────── */
const mockCreateBaseEmbed = jest.fn();
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockSendLog = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: mockSendLog,
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C' },
}));

import { mockInteraction, mockUser, mockTextChannel } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* ── Helpers ─────────────────────────────────────────────── */

function fakeEmbed() {
  return {
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setAuthor: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
  };
}

function makeMessages(count: number, authorId = 'user-1'): Collection<string, any> {
  const col = new Collection<string, any>();
  for (let i = 0; i < count; i++) {
    col.set(`msg-${i}`, {
      id: `msg-${i}`,
      author: { id: authorId },
      createdTimestamp: Date.now() - 1000 * i,
    });
  }
  return col;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateBaseEmbed.mockReturnValue(fakeEmbed());
});

/* ── Tests ───────────────────────────────────────────────── */

describe('/clear – data & options', () => {
  it('has correct name and permissions', () => {
    const { data, options } = require('../../../src/commands/moderation/clear');
    expect(data.name).toBe('clear');
    expect(options.guildOnly).toBe(true);
  });

  it('requires ilosc integer option (1-500)', () => {
    const { data } = require('../../../src/commands/moderation/clear');
    const json = data.toJSON();
    const iloscOpt = json.options.find((o: any) => o.name === 'ilosc');
    expect(iloscOpt).toBeDefined();
    expect(iloscOpt.required).toBe(true);
    expect(iloscOpt.min_value).toBe(1);
    expect(iloscOpt.max_value).toBe(500);
  });

  it('has optional uzytkownik option', () => {
    const { data } = require('../../../src/commands/moderation/clear');
    const json = data.toJSON();
    const userOpt = json.options.find((o: any) => o.name === 'uzytkownik');
    expect(userOpt).toBeDefined();
    expect(userOpt.required).toBeFalsy();
  });
});

describe('/clear – run()', () => {
  const { run } = require('../../../src/commands/moderation/clear');

  it('defers reply as ephemeral', async () => {
    const channel = mockTextChannel();
    channel.bulkDelete = jest.fn().mockResolvedValue(new Collection());
    channel.messages = { fetch: jest.fn().mockResolvedValue(makeMessages(0)) };

    const interaction = mockInteraction({ channel });
    interaction.options.getInteger = jest.fn().mockReturnValue(10);
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('deletes messages and reports count', async () => {
    const msgs = makeMessages(10);
    const channel = mockTextChannel();
    channel.bulkDelete = jest.fn().mockResolvedValue(msgs);
    channel.messages = { fetch: jest.fn().mockResolvedValue(msgs) };

    const interaction = mockInteraction({ channel });
    interaction.options.getInteger = jest.fn().mockReturnValue(10);
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(channel.bulkDelete).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('10'),
      })
    );
  });

  it('filters by user when uzytkownik is provided', async () => {
    const targetUser = mockUser({ id: 'target-1' });
    const mixed = new Collection<string, any>();
    for (let i = 0; i < 5; i++) {
      mixed.set(`msg-t-${i}`, {
        id: `msg-t-${i}`,
        author: { id: 'target-1' },
        createdTimestamp: Date.now(),
      });
    }
    for (let i = 0; i < 5; i++) {
      mixed.set(`msg-o-${i}`, {
        id: `msg-o-${i}`,
        author: { id: 'other-1' },
        createdTimestamp: Date.now(),
      });
    }

    const channel = mockTextChannel();
    const deletedMsgs = new Collection<string, any>();
    for (let i = 0; i < 5; i++) {
      deletedMsgs.set(`msg-t-${i}`, mixed.get(`msg-t-${i}`));
    }
    channel.bulkDelete = jest.fn().mockResolvedValue(deletedMsgs);
    channel.messages = { fetch: jest.fn().mockResolvedValue(mixed) };

    const interaction = mockInteraction({ channel });
    interaction.options.getInteger = jest.fn().mockReturnValue(5);
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);

    await run({ interaction, client: interaction.client });

    // Verify that bulkDelete was called with only the target user's messages
    const deletedArg = channel.bulkDelete.mock.calls[0][0];
    expect(deletedArg.size).toBe(5);
    deletedArg.forEach((msg: any) => {
      expect(msg.author.id).toBe('target-1');
    });
  });

  it('reports error for non-text channels', async () => {
    const channel = { id: 'ch-1', name: 'no-bulk' }; // no bulkDelete
    const interaction = mockInteraction({ channel } as any);
    interaction.options.getInteger = jest.fn().mockReturnValue(5);
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        isError: true,
        description: expect.stringContaining('kanale tekstowym'),
      })
    );
  });

  it('handles empty channel (0 messages fetched)', async () => {
    const channel = mockTextChannel();
    channel.bulkDelete = jest.fn();
    channel.messages = { fetch: jest.fn().mockResolvedValue(new Collection()) };

    const interaction = mockInteraction({ channel });
    interaction.options.getInteger = jest.fn().mockReturnValue(10);
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(channel.bulkDelete).not.toHaveBeenCalled();
    expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('0'),
      })
    );
  });

  it('skips messages older than 14 days', async () => {
    const oldMessages = new Collection<string, any>();
    for (let i = 0; i < 5; i++) {
      oldMessages.set(`old-${i}`, {
        id: `old-${i}`,
        author: { id: 'user-1' },
        createdTimestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
      });
    }

    const channel = mockTextChannel();
    channel.bulkDelete = jest.fn();
    channel.messages = { fetch: jest.fn().mockResolvedValue(oldMessages) };

    const interaction = mockInteraction({ channel });
    interaction.options.getInteger = jest.fn().mockReturnValue(5);
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    // bulkDelete should NOT be called because all messages are too old
    expect(channel.bulkDelete).not.toHaveBeenCalled();
    expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('0'),
      })
    );
  });

  it('sends audit log after successful purge', async () => {
    const msgs = makeMessages(3);
    const channel = mockTextChannel();
    channel.bulkDelete = jest.fn().mockResolvedValue(msgs);
    channel.messages = { fetch: jest.fn().mockResolvedValue(msgs) };

    const interaction = mockInteraction({ channel });
    interaction.options.getInteger = jest.fn().mockReturnValue(3);
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(mockSendLog).toHaveBeenCalledWith(
      interaction.client,
      interaction.guildId,
      'messageDelete',
      expect.objectContaining({
        title: expect.stringContaining('Masowe usunięcie'),
        description: expect.stringContaining('3'),
      })
    );
  });

  it('handles errors gracefully', async () => {
    const channel = mockTextChannel();
    channel.messages = {
      fetch: jest.fn().mockRejectedValue(new Error('Discord API error')),
    };
    channel.bulkDelete = jest.fn();

    const interaction = mockInteraction({ channel });
    interaction.options.getInteger = jest.fn().mockReturnValue(5);
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        isError: true,
        description: expect.stringContaining('Wystąpił błąd'),
      })
    );
  });

  it('handles user mention in description when user filter is used', async () => {
    const targetUser = mockUser({ id: 'target-1' });
    const msgs = makeMessages(3, 'target-1');
    const channel = mockTextChannel();
    channel.bulkDelete = jest.fn().mockResolvedValue(msgs);
    channel.messages = { fetch: jest.fn().mockResolvedValue(msgs) };

    const interaction = mockInteraction({ channel });
    interaction.options.getInteger = jest.fn().mockReturnValue(3);
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);

    await run({ interaction, client: interaction.client });

    expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('<@target-1>'),
      })
    );
  });
});
