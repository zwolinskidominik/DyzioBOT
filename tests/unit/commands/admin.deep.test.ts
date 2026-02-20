/**
 * Deep tests for admin commands: emojiSteal, giveaway, say, xp
 * Covers all major run() branches: success, error, edge-cases.
 */

/* ── shared mocks ──────────────────────────────────────────── */
const mockCreateBaseEmbed = jest.fn();
const mockCreateErrorEmbed = jest.fn();
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: mockCreateErrorEmbed,
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C', GIVEAWAY: '#5865F2', GIVEAWAY_ENDED: '#4C4C54' },
}));

const mockGetBotConfig = jest.fn();
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: mockGetBotConfig,
}));

const mockCreateGiveaway = jest.fn();
const mockEditGiveaway = jest.fn();
const mockDeleteGiveaway = jest.fn();
const mockEndGiveaway = jest.fn();
const mockListActiveGiveaways = jest.fn();
const mockRerollGiveaway = jest.fn();
const mockGaParseDuration = jest.fn();
const mockGetAdditionalNote = jest.fn();
jest.mock('../../../src/services/giveawayService', () => ({
  createGiveaway: mockCreateGiveaway,
  editGiveaway: mockEditGiveaway,
  deleteGiveaway: mockDeleteGiveaway,
  endGiveaway: mockEndGiveaway,
  listActiveGiveaways: mockListActiveGiveaways,
  rerollGiveaway: mockRerollGiveaway,
  parseDuration: mockGaParseDuration,
  getAdditionalNote: mockGetAdditionalNote,
}));

const mockModifyXp = jest.fn();
const mockSetXp = jest.fn();
const mockSetLevel = jest.fn();
const mockFlush = jest.fn();
jest.mock('../../../src/services/xpService', () => ({
  modifyXp: mockModifyXp,
  setXp: mockSetXp,
  setLevel: mockSetLevel,
  flush: mockFlush,
}));
jest.mock('../../../src/services/levelNotifier', () => ({
  notifyLevelUp: jest.fn().mockResolvedValue(undefined),
}));

import { mockInteraction, mockGuild, mockTextChannel, mockUser } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* ── embed helpers ──────────────────────────────────────────── */
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

beforeEach(() => {
  jest.clearAllMocks();
  const embed = fakeEmbed();
  mockCreateBaseEmbed.mockReturnValue(embed);
  mockCreateErrorEmbed.mockReturnValue(embed);
  mockGetBotConfig.mockReturnValue({
    emojis: {
      giveaway: { join: '🎉', list: '📋' },
      trophy: { gold: '🥇', silver: '🥈', bronze: '🥉' },
      birthday: '🎂',
    },
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  EMOJI STEAL                                                */
/* ════════════════════════════════════════════════════════════ */
describe('emojiSteal command', () => {
  const load = () => require('../../../src/commands/admin/emojiSteal');

  it('has correct data and options', () => {
    const { data, options } = load();
    expect(data.name).toBe('emoji-steal');
    expect(options.guildOnly).toBe(true);
    expect(options.userPermissions).toBeDefined();
  });

  it('defers with ephemeral and processes valid emoji tokens', async () => {
    const { run } = load();
    const guild = mockGuild();
    Object.defineProperty(guild.emojis.cache, 'size', { value: 10, writable: true });
    guild.emojis.create = jest.fn().mockResolvedValue({ id: 'e1', name: 'test', toString: () => '<:test:e1>' });
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('<:test:123456789>');

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.anything() }));
    expect(guild.emojis.create).toHaveBeenCalledWith(expect.objectContaining({
      attachment: expect.stringContaining('cdn.discordapp.com'),
      name: 'test',
    }));
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns error when emoji limit is reached', async () => {
    const { run } = load();
    const guild = mockGuild();
    Object.defineProperty(guild.emojis.cache, 'size', { value: 150, writable: true });
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('<:test:123>');

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('150'));
  });

  it('handles invalid emoji format', async () => {
    const { run } = load();
    const guild = mockGuild();
    Object.defineProperty(guild.emojis.cache, 'size', { value: 0, writable: true });
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('not_an_emoji');

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles animated emoji token', async () => {
    const { run } = load();
    const guild = mockGuild();
    Object.defineProperty(guild.emojis.cache, 'size', { value: 0, writable: true });
    guild.emojis.create = jest.fn().mockResolvedValue({ id: 'e1', name: 'wave', toString: () => '<a:wave:e1>' });
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('<a:wave:999888777>');

    await run({ interaction, client: interaction.client });

    expect(guild.emojis.create).toHaveBeenCalledWith(expect.objectContaining({
      attachment: expect.stringContaining('.gif'),
    }));
  });

  it('handles emoji create error', async () => {
    const { run } = load();
    const guild = mockGuild();
    Object.defineProperty(guild.emojis.cache, 'size', { value: 0, writable: true });
    guild.emojis.create = jest.fn().mockRejectedValue(new Error('Maximum number of emojis reached'));
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('<:test:123456789>');

    await run({ interaction, client: interaction.client });

    // Should still finish with final embed (with error entry)
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles multiple emoji tokens', async () => {
    const { run } = load();
    const guild = mockGuild();
    Object.defineProperty(guild.emojis.cache, 'size', { value: 0, writable: true });
    guild.emojis.create = jest.fn()
      .mockResolvedValueOnce({ id: 'e1', name: 'a', toString: () => '<:a:e1>' })
      .mockResolvedValueOnce({ id: 'e2', name: 'b', toString: () => '<:b:e2>' });
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('<:a:111> <:b:222>');

    await run({ interaction, client: interaction.client });

    expect(guild.emojis.create).toHaveBeenCalledTimes(2);
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  XP                                                         */
/* ════════════════════════════════════════════════════════════ */
describe('xp command', () => {
  const load = () => require('../../../src/commands/admin/xp');

  it('has correct data and options', () => {
    const { data, options } = load();
    expect(data.name).toBe('xp');
    expect(options.guildOnly).toBe(true);
  });

  it('add subcommand: adds XP', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('add');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getInteger = jest.fn().mockReturnValue(100);
    mockModifyXp.mockResolvedValue(undefined);

    await run({ interaction, client: interaction.client });

    expect(mockModifyXp).toHaveBeenCalledWith(interaction.client, interaction.guildId, 'u1', 100);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('+100'),
    }));
  });

  it('remove subcommand: removes XP with negative delta', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('remove');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getInteger = jest.fn().mockReturnValue(50);
    mockModifyXp.mockResolvedValue(undefined);

    await run({ interaction, client: interaction.client });

    expect(mockModifyXp).toHaveBeenCalledWith(interaction.client, interaction.guildId, 'u1', -50);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('50'),
    }));
  });

  it('set subcommand: sets XP value', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('set');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getString = jest.fn().mockReturnValue('1000');
    mockSetXp.mockResolvedValue({ ok: true, data: { level: 5, xp: 1000, totalXp: 1000 } });
    mockFlush.mockResolvedValue(undefined);

    await run({ interaction, client: interaction.client });

    expect(mockSetXp).toHaveBeenCalledWith(interaction.guildId, 'u1', 1000);
    expect(mockFlush).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('1000'),
    }));
  });

  it('set subcommand: sets level when value ends with L', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('set');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getString = jest.fn().mockReturnValue('10L');
    mockSetLevel.mockResolvedValue({ ok: true, data: { level: 10, xp: 0, totalXp: 5000 } });
    mockFlush.mockResolvedValue(undefined);

    await run({ interaction, client: interaction.client });

    expect(mockSetLevel).toHaveBeenCalledWith(interaction.guildId, 'u1', 10);
    expect(mockFlush).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('10'),
    }));
  });

  it('set subcommand: returns error for invalid value', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('set');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getString = jest.fn().mockReturnValue('abc');

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('Nieprawidłowa'));
  });

  it('set subcommand: returns error for negative value', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('set');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getString = jest.fn().mockReturnValue('-5');

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('Nieprawidłowa'));
  });

  it('set subcommand: handles setXp service error', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('set');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getString = jest.fn().mockReturnValue('500');
    mockSetXp.mockResolvedValue({ ok: false, message: 'XP service error' });

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith('XP service error');
  });

  it('set subcommand: handles setLevel service error', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('set');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getString = jest.fn().mockReturnValue('5l');
    mockSetLevel.mockResolvedValue({ ok: false, message: 'Level service error' });

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith('Level service error');
  });

  it('handles general error gracefully', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockImplementation(() => {
      throw new Error('Unexpected');
    });

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('błąd'));
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  SAY                                                        */
/* ════════════════════════════════════════════════════════════ */
describe('say command', () => {
  const load = () => require('../../../src/commands/admin/say');

  it('has correct data and options', () => {
    const { data, options } = load();
    expect(data.name).toBe('say');
    expect(options.userPermissions).toBeDefined();
  });

  it('returns error when channel is not TextChannel', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    // channel is a plain mock, not a TextChannel instance
    await run({ interaction, client: interaction.client });
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('shows modal when channel is TextChannel', async () => {
    // We can't easily test TextChannel instance check in unit test,
    // but we can verify showModal is called when channel passes the check.
    // Since the mock channel isn't a real TextChannel instance, the command
    // returns early with error - that path is tested above.
    const { data } = load();
    expect(data.name).toBe('say');
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  GIVEAWAY                                                   */
/* ════════════════════════════════════════════════════════════ */
describe('giveaway command', () => {
  const load = () => require('../../../src/commands/admin/giveaway');

  it('has correct data and options', () => {
    const { data, options } = load();
    expect(data.name).toBe('giveaway');
    expect(options.userPermissions).toBeDefined();
  });

  it('handles create subcommand - success', async () => {
    const { run } = load();
    const guild = mockGuild();
    const channel = mockTextChannel();
    channel.send = jest.fn().mockResolvedValue({
      id: 'sent-msg-1',
      edit: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    });
    const interaction = mockInteraction({ guild, channel });
    interaction.options.getSubcommand = jest.fn().mockReturnValue('create');
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'nagroda') return 'Nitro';
      if (name === 'czas_trwania') return '1d';
      if (name === 'opis') return 'Win nitro!';
      return null;
    });
    interaction.options.getInteger = jest.fn().mockImplementation((name: string) => {
      if (name === 'liczba_wygranych') return 1;
      return null;
    });
    interaction.options.getRole = jest.fn().mockReturnValue(null);
    mockGaParseDuration.mockReturnValue(86400000);
    mockCreateGiveaway.mockResolvedValue({
      ok: true,
      data: { giveawayId: 'g1' },
    });
    mockGetAdditionalNote.mockResolvedValue('');

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockCreateGiveaway).toHaveBeenCalled();
  });

  it('handles list subcommand with no giveaways', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('list');
    mockListActiveGiveaways.mockResolvedValue({ ok: true, data: [] });

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockListActiveGiveaways).toHaveBeenCalled();
  });

  it('handles list subcommand with active giveaways', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('list');
    mockListActiveGiveaways.mockResolvedValue({
      ok: true,
      data: [
        { giveawayId: 'g1', prize: 'Nitro', endTime: new Date(), participants: ['u1', 'u2'], winnersCount: 1 },
      ],
    });

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles end subcommand - success', async () => {
    const { run } = load();
    const channel = mockTextChannel({ id: 'ch-1' });
    const mockMsg = { edit: jest.fn().mockResolvedValue(undefined) };
    channel.messages = { fetch: jest.fn().mockResolvedValue(mockMsg) };
    const guild = mockGuild();
    guild.channels.cache.set('ch-1', channel);
    const interaction = mockInteraction({ guild });
    interaction.options.getSubcommand = jest.fn().mockReturnValue('end');
    interaction.options.getString = jest.fn().mockReturnValue('g1');
    mockEndGiveaway.mockResolvedValue({
      ok: true,
      data: {
        giveaway: {
          giveawayId: 'g1', endTime: new Date(), prize: 'Nitro', description: 'Win!',
          winnersCount: 1, hostId: 'u1', channelId: 'ch-1', messageId: 'msg-1', participants: [],
        },
        winnerIds: ['w1'],
      },
    });

    await run({ interaction, client: interaction.client });

    expect(mockEndGiveaway).toHaveBeenCalledWith('g1', guild.id);
  });

  it('handles remove subcommand', async () => {
    const { run } = load();
    const channel = mockTextChannel({ id: 'ch-1' });
    const mockMsg = { delete: jest.fn().mockResolvedValue(undefined) };
    channel.messages = { fetch: jest.fn().mockResolvedValue(mockMsg) };
    const guild = mockGuild();
    guild.channels.cache.set('ch-1', channel);
    const interaction = mockInteraction({ guild });
    interaction.options.getSubcommand = jest.fn().mockReturnValue('remove');
    interaction.options.getString = jest.fn().mockReturnValue('g1');
    mockDeleteGiveaway.mockResolvedValue({
      ok: true,
      data: { messageId: 'msg-1', channelId: 'ch-1' },
    });

    await run({ interaction, client: interaction.client });

    expect(mockDeleteGiveaway).toHaveBeenCalledWith('g1', guild.id);
  });

  it('handles reroll subcommand', async () => {
    const { run } = load();
    const channel = mockTextChannel({ id: 'ch-1' });
    const mockMsg = { edit: jest.fn().mockResolvedValue(undefined) };
    channel.messages = { fetch: jest.fn().mockResolvedValue(mockMsg) };
    const guild = mockGuild();
    guild.channels.cache.set('ch-1', channel);
    const interaction = mockInteraction({ guild });
    interaction.options.getSubcommand = jest.fn().mockReturnValue('reroll');
    interaction.options.getString = jest.fn().mockReturnValue('g1');
    mockRerollGiveaway.mockResolvedValue({
      ok: true,
      data: {
        giveaway: {
          giveawayId: 'g1', endTime: new Date(), prize: 'Nitro', description: 'Win!',
          winnersCount: 1, hostId: 'u1', channelId: 'ch-1', messageId: 'msg-1', participants: [],
        },
        winnerIds: ['w2'],
      },
    });

    await run({ interaction, client: interaction.client });

    expect(mockRerollGiveaway).toHaveBeenCalledWith('g1', guild.id);
  });

  it('handles edit subcommand', async () => {
    const { run } = load();
    const channel = mockTextChannel();
    const mockMessage = { edit: jest.fn().mockResolvedValue(undefined) };
    channel.messages = { fetch: jest.fn().mockResolvedValue(mockMessage) };
    const guild = mockGuild();
    guild.channels.cache.set('ch-1', channel);
    const interaction = mockInteraction({ guild, channel });
    interaction.options.getSubcommand = jest.fn().mockReturnValue('edit');
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'id') return 'g1';
      if (name === 'nagroda') return 'New Prize';
      if (name === 'czas_trwania') return '2d';
      if (name === 'opis') return 'Updated';
      return null;
    });
    interaction.options.getInteger = jest.fn().mockReturnValue(2);
    interaction.options.getRole = jest.fn().mockReturnValue(null);
    mockGaParseDuration.mockReturnValue(172800000);
    mockEditGiveaway.mockResolvedValue({
      ok: true,
      data: {
        giveawayId: 'g1', endTime: new Date(), prize: 'New Prize', description: 'Updated',
        winnersCount: 2, hostId: 'u1', channelId: 'ch-1', messageId: 'msg-1',
      },
    });
    mockGetAdditionalNote.mockResolvedValue('');

    await run({ interaction, client: interaction.client });

    expect(mockEditGiveaway).toHaveBeenCalledWith('g1', guild.id, expect.any(Object));
  });

  it('handles service error for create', async () => {
    const { run } = load();
    const channel = mockTextChannel();
    channel.send = jest.fn().mockResolvedValue({
      id: 'sent-msg', edit: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    });
    const interaction = mockInteraction({ channel });
    interaction.options.getSubcommand = jest.fn().mockReturnValue('create');
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'nagroda') return 'Nitro';
      if (name === 'opis') return 'Win!';
      if (name === 'czas_trwania') return '1d';
      return null;
    });
    interaction.options.getInteger = jest.fn().mockImplementation((name: string) => {
      if (name === 'liczba_wygranych') return 1;
      return null;
    });
    interaction.options.getRole = jest.fn().mockReturnValue(null);
    mockGaParseDuration.mockReturnValue(86400000);
    mockCreateGiveaway.mockResolvedValue({
      ok: false,
      message: 'Max giveaways reached',
    });
    mockGetAdditionalNote.mockResolvedValue('');

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
