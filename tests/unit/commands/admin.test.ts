/**
 * Tests for admin commands: emojiSteal, giveaway, say, xp
 */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({ addFields: jest.fn().mockReturnThis() }),
  createErrorEmbed: jest.fn().mockReturnValue({}),
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C', GIVEAWAY: '#5865F2', GIVEAWAY_ENDED: '#4C4C54' },
}));
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      giveaway: { join: '🎉', list: '📋' },
      trophy: { gold: '🥇', silver: '🥈', bronze: '🥉' },
    },
  }),
}));
jest.mock('../../../src/services/giveawayService', () => ({
  createGiveaway: jest.fn().mockResolvedValue({ ok: true, data: { giveawayId: 'g1' } }),
  editGiveaway: jest.fn().mockResolvedValue({ ok: true, data: { giveawayId: 'g1', endTime: new Date(), prize: 'P', description: 'D', winnersCount: 1, hostId: 'u1', channelId: 'ch1', messageId: 'msg1' } }),
  deleteGiveaway: jest.fn().mockResolvedValue({ ok: true, data: { messageId: 'msg1', channelId: 'ch1' } }),
  endGiveaway: jest.fn().mockResolvedValue({ ok: true, data: { giveaway: { giveawayId: 'g1', endTime: new Date(), prize: 'P', description: 'D', winnersCount: 1, hostId: 'u1', channelId: 'ch1', messageId: 'msg1', participants: [] }, winnerIds: [] } }),
  listActiveGiveaways: jest.fn().mockResolvedValue({ ok: true, data: [] }),
  rerollGiveaway: jest.fn().mockResolvedValue({ ok: true, data: { giveaway: { giveawayId: 'g1', endTime: new Date(), prize: 'P', description: 'D', winnersCount: 1, hostId: 'u1', channelId: 'ch1', messageId: 'msg1', participants: [] }, winnerIds: [] } }),
  parseDuration: jest.fn().mockReturnValue(86400000),
  getAdditionalNote: jest.fn().mockResolvedValue(''),
}));
jest.mock('../../../src/services/xpService', () => ({
  RankCardData: jest.fn(),
  modifyXp: jest.fn().mockResolvedValue(undefined),
  setXp: jest.fn().mockResolvedValue({ ok: true, data: { level: 5, xp: 100, totalXp: 500 } }),
  setLevel: jest.fn().mockResolvedValue({ ok: true, data: { level: 5, xp: 0, totalXp: 500 } }),
  flush: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/levelNotifier', () => ({
  notifyLevelUp: jest.fn().mockResolvedValue(undefined),
}));

import { mockInteraction, mockGuild, mockTextChannel } from '../../helpers/discordMocks';

describe('Admin commands - data exports', () => {
  it('emojiSteal has correct command data', () => {
    const { data } = require('../../../src/commands/admin/emojiSteal');
    expect(data.name).toBe('emoji-steal');
    expect(data.description).toBeTruthy();
  });

  it('giveaway has correct command data', () => {
    const { data } = require('../../../src/commands/admin/giveaway');
    expect(data.name).toBe('giveaway');
    expect(data.description).toBeTruthy();
  });

  it('say has correct command data', () => {
    const { data } = require('../../../src/commands/admin/say');
    expect(data.name).toBe('say');
    expect(data.description).toBeTruthy();
  });

  it('xp has correct command data', () => {
    const { data } = require('../../../src/commands/admin/xp');
    expect(data.name).toBe('xp');
    expect(data.description).toBeTruthy();
  });
});

describe('Admin commands - options exports', () => {
  it('emojiSteal requires Administrator', () => {
    const { options } = require('../../../src/commands/admin/emojiSteal');
    expect(options.userPermissions).toBeDefined();
    expect(options.guildOnly).toBe(true);
  });

  it('giveaway requires Administrator', () => {
    const { options } = require('../../../src/commands/admin/giveaway');
    expect(options.userPermissions).toBeDefined();
  });

  it('say requires Administrator', () => {
    const { options } = require('../../../src/commands/admin/say');
    expect(options.userPermissions).toBeDefined();
  });

  it('xp uses setDefaultMemberPermissions on builder', () => {
    const { data } = require('../../../src/commands/admin/xp');
    expect(data.default_member_permissions).toBeDefined();
  });
});

describe('Admin commands - run functions', () => {
  it('emojiSteal.run defers and handles empty input', async () => {
    const { run } = require('../../../src/commands/admin/emojiSteal');
    const guild = mockGuild();
    // Use Object.defineProperty to override the getter
    Object.defineProperty(guild.emojis.cache, 'size', { value: 0, writable: true });
    const interaction = mockInteraction({
      guild,
    });
    interaction.options.getString = jest.fn().mockReturnValue('<:test:123>');
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('say.run replies with error when not in TextChannel', async () => {
    const { run } = require('../../../src/commands/admin/say');
    const interaction = mockInteraction();
    // channel is not a TextChannel instance, so say.run replies with error
    await run({ interaction, client: interaction.client });
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('xp.run handles add subcommand', async () => {
    const { run } = require('../../../src/commands/admin/xp');
    const interaction = mockInteraction();
    interaction.options.getSubcommand = jest.fn().mockReturnValue('add');
    interaction.options.getUser = jest.fn().mockReturnValue({ id: 'u1', username: 'Test' });
    interaction.options.getInteger = jest.fn().mockReturnValue(100);
    await run({ interaction, client: interaction.client });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});
