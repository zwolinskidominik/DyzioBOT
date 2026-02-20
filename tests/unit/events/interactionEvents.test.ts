/**
 * Tests for interaction-related events:
 * - giveawayHandler, handleSuggestions, monthlyStatsButtons
 * - musicButtons, ticketSystem, voiceControl
 */

/* ── mocks ───────────────────────────────────────────────── */

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    setTimestamp: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  }),
  formatResults: jest.fn().mockReturnValue('results'),
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: {
    GIVEAWAY: 0xff0000,
    GIVEAWAY_ENDED: 0x808080,
    MUSIC: 0x00ff00,
    MUSIC_PAUSE: 0xffff00,
    MUSIC_SUCCESS: 0x00ff00,
    DEFAULT: 0x000000,
  },
}));

jest.mock('../../../src/services/giveawayService', () => ({
  joinGiveaway: jest.fn().mockResolvedValue({ ok: true, data: { multiplier: 1 } }),
  leaveGiveaway: jest.fn().mockResolvedValue({ ok: true }),
  getActiveGiveaway: jest.fn().mockResolvedValue({
    ok: true,
    data: {
      giveawayId: 'gw-1',
      guildId: 'guild-1',
      channelId: 'ch-1',
      messageId: 'msg-1',
      participants: [],
      winnersCount: 1,
      prize: 'Prize',
    },
  }),
  getGiveaway: jest.fn().mockResolvedValue({ ok: true, data: { participants: [], winnersCount: 1 } }),
}));

jest.mock('../../../src/services/suggestionService', () => ({
  vote: jest.fn().mockResolvedValue({ ok: true, data: { upvotes: 1, downvotes: 0 } }),
  getSuggestion: jest.fn().mockResolvedValue({ ok: true, data: { messageId: 'msg-1' } }),
}));

jest.mock('../../../src/services/monthlyStatsService', () => ({
  getPersonalStats: jest.fn().mockResolvedValue({
    ok: true,
    data: { messageCount: 100, voiceMinutes: 60, messageRank: 1, voiceRank: 1, totalMessages: 1000 },
  }),
  getMonthString: jest.fn().mockReturnValue('2025-12'),
  formatVoiceTime: jest.fn().mockReturnValue('1h 0m'),
  MONTH_NAMES: { '01': 'Styczeń', '02': 'Luty', '12': 'Grudzień' },
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      giveaway: { join: '🎉', list: '📋' },
      monthlyStats: { upvote: '🔼', downvote: '🔽', whitedash: '➖' },
    },
  }),
}));

jest.mock('../../../src/services/musicPlayer', () => ({
  getMusicPlayer: jest.fn().mockReturnValue(null),
  QueueMetadata: {},
}));

jest.mock('../../../src/services/ticketService', () => ({
  validateTicketCreation: jest.fn().mockResolvedValue({ ok: false, message: 'error' }),
  takeTicket: jest.fn().mockResolvedValue({ ok: true }),
  closeTicket: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../../../src/config/guild', () => ({
  getGuildConfig: jest.fn().mockReturnValue({
    roles: { owner: 'r1', admin: 'r2', mod: 'r3', partnership: 'r4' },
  }),
}));

jest.mock('../../../src/services/tempChannelService', () => ({
  validateOwnership: jest.fn().mockResolvedValue({ ok: false, code: 'NOT_FOUND' }),
  transferOwnership: jest.fn().mockResolvedValue({ ok: true, data: { oldOwnerId: 'u1' } }),
  getTempChannel: jest.fn().mockResolvedValue({ ok: false }),
  setControlMessageId: jest.fn(),
}));

jest.mock('../../../src/utils/channelHelpers', () => ({
  safeSetChannelName: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('lodash', () => ({
  chunk: jest.fn((arr: any[], size: number) => {
    const result: any[][] = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
  }),
}));

import { mockClient, mockGuild, mockButtonInteraction, mockTextChannel, mockGuildMember } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* ── giveawayHandler ──────────────────────────────────────── */

describe('interactionCreate / giveawayHandler', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/interactionCreate/giveawayHandler')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores non-button interactions', async () => {
    const interaction = mockButtonInteraction({ customId: 'random_btn' });
    interaction.isButton = jest.fn().mockReturnValue(false);
    await run(interaction, mockClient());
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('ignores non-giveaway customIds', async () => {
    const interaction = mockButtonInteraction({ customId: 'other_btn' });
    await run(interaction, mockClient());
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('handles giveaway_cancel_ephemeral', async () => {
    const interaction = mockButtonInteraction({
      customId: 'giveaway_cancel_ephemeral',
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      deleteReply: jest.fn().mockResolvedValue(undefined),
    });
    await run(interaction, mockClient());
    expect(interaction.deferUpdate).toHaveBeenCalled();
    expect(interaction.deleteReply).toHaveBeenCalled();
  });

  it('handles join action', async () => {
    const guild = mockGuild();
    const channel = mockTextChannel();
    channel.messages = { fetch: jest.fn().mockResolvedValue({ edit: jest.fn() }) };
    guild.channels.cache = new Collection([['ch-1', channel]]);

    const client = mockClient();
    client.guilds.cache = new Collection([['guild-1', guild]]);
    client.user = { id: 'bot-id' };

    const member = mockGuildMember();
    member.roles = { cache: new Collection([['r1', { id: 'r1' }]]) };

    const interaction = mockButtonInteraction({
      customId: 'giveaway_join_gw-1',
      guild,
      member,
    });
    interaction.deferReply = jest.fn().mockResolvedValue(undefined);
    interaction.editReply = jest.fn().mockResolvedValue(undefined);

    await run(interaction, client);
    expect(interaction.deferReply).toHaveBeenCalled();
  });
});

/* ── handleSuggestions ────────────────────────────────────── */

describe('interactionCreate / handleSuggestions', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/interactionCreate/handleSuggestions')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores non-button', async () => {
    const interaction = mockButtonInteraction({ customId: 'suggestion.s1.upvote' });
    interaction.isButton = jest.fn().mockReturnValue(false);
    await run(interaction);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('ignores non-suggestion customIds', async () => {
    const interaction = mockButtonInteraction({ customId: 'other.x.y' });
    await run(interaction);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('handles upvote', async () => {
    const targetMsg = {
      embeds: [{ fields: [{}, { value: '' }] }],
      edit: jest.fn().mockResolvedValue(undefined),
    };
    const channel = mockTextChannel();
    channel.messages = { fetch: jest.fn().mockResolvedValue(targetMsg) };

    const interaction = mockButtonInteraction({
      customId: 'suggestion.s1.upvote',
      channel,
    });
    interaction.client = mockClient();
    interaction.deferReply = jest.fn().mockResolvedValue(undefined);
    interaction.editReply = jest.fn().mockResolvedValue(undefined);

    await run(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith('Oddano głos na tak!');
  });
});

/* ── monthlyStatsButtons ──────────────────────────────────── */

describe('interactionCreate / monthlyStatsButtons', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/interactionCreate/monthlyStatsButtons')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores non-button', async () => {
    const interaction = mockButtonInteraction({ customId: 'monthly_stats:details:2026-01' });
    interaction.isButton = jest.fn().mockReturnValue(false);
    await run(interaction);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('ignores non-monthly_stats prefix', async () => {
    const interaction = mockButtonInteraction({ customId: 'other:action:data' });
    await run(interaction);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('handles details action', async () => {
    const interaction = mockButtonInteraction({
      customId: 'monthly_stats:details:2026-01',
      guildId: 'guild-1',
    });
    interaction.client = mockClient();
    interaction.deferReply = jest.fn().mockResolvedValue(undefined);
    interaction.editReply = jest.fn().mockResolvedValue(undefined);

    await run(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
  });
});

/* ── musicButtons ─────────────────────────────────────────── */

describe('interactionCreate / musicButtons', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/interactionCreate/musicButtons')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores non-button interactions', async () => {
    const interaction = mockButtonInteraction({ customId: 'music_pause' });
    interaction.isButton = jest.fn().mockReturnValue(false);
    await run(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('ignores non-music customIds', async () => {
    const interaction = mockButtonInteraction({ customId: 'other_button' });
    await run(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('returns when no guild', async () => {
    const interaction = mockButtonInteraction({ customId: 'music_pause', guild: null });
    await run(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('returns when no player', async () => {
    const interaction = mockButtonInteraction({ customId: 'music_pause' });
    interaction.guild = mockGuild();
    const member = mockGuildMember();
    member.voice = { channel: { id: 'vc-1' } };
    interaction.member = member;
    await run(interaction);
    // getMusicPlayer returns null, so no action
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

/* ── ticketSystem ─────────────────────────────────────────── */

describe('interactionCreate / ticketSystem', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/interactionCreate/ticketSystem')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('handles string select menu for ticket-menu', async () => {
    const interaction = mockButtonInteraction({ customId: 'ticket-menu' });
    interaction.isStringSelectMenu = jest.fn().mockReturnValue(true);
    interaction.isButton = jest.fn().mockReturnValue(false);
    interaction.values = ['help'];
    interaction.guild = mockGuild();
    interaction.deferReply = jest.fn().mockResolvedValue(undefined);
    interaction.editReply = jest.fn().mockResolvedValue(undefined);

    await run(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('ignores unknown button customIds', async () => {
    const interaction = mockButtonInteraction({ customId: 'unknown-btn' });
    interaction.isStringSelectMenu = jest.fn().mockReturnValue(false);
    interaction.deferUpdate = jest.fn();
    await run(interaction);
    expect(interaction.deferUpdate).not.toHaveBeenCalled();
  });

  it('handles take ticket button', async () => {
    const interaction = mockButtonInteraction({ customId: 'zajmij-zgloszenie' });
    interaction.isStringSelectMenu = jest.fn().mockReturnValue(false);
    interaction.guild = mockGuild();
    interaction.channel = mockTextChannel();
    const member = mockGuildMember();
    member.roles.cache = new Collection([['r1', { id: 'r1' }]]);
    interaction.member = member;
    interaction.deferUpdate = jest.fn().mockResolvedValue(undefined);
    interaction.followUp = jest.fn().mockResolvedValue(undefined);
    interaction.message = {
      components: [{
        components: [{
          type: 2,
          customId: 'zajmij-zgloszenie',
          label: 'Zajmij zgłoszenie',
          style: 1,
        }],
      }],
      edit: jest.fn().mockResolvedValue(undefined),
    };

    await run(interaction);
    expect(interaction.deferUpdate).toHaveBeenCalled();
  });
});

/* ── voiceControl ─────────────────────────────────────────── */

describe('interactionCreate / voiceControl', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/interactionCreate/voiceControl')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('ignores non-button/non-modal/non-select interactions', async () => {
    const interaction = {
      isButton: jest.fn().mockReturnValue(false),
      isModalSubmit: jest.fn().mockReturnValue(false),
      isStringSelectMenu: jest.fn().mockReturnValue(false),
    };
    await run(interaction);
    // No error thrown
  });

  it('handles voice_limit button with ownership validation failure', async () => {
    const interaction = mockButtonInteraction({ customId: 'voice_limit' });
    interaction.inGuild = jest.fn().mockReturnValue(true);
    interaction.channelId = 'vc-1';
    interaction.isModalSubmit = jest.fn().mockReturnValue(false);
    interaction.isStringSelectMenu = jest.fn().mockReturnValue(false);

    await run(interaction);
    expect(interaction.reply).toHaveBeenCalled(); // ownership error reply
  });

  it('exports createControlPanelButtons', async () => {
    const { createControlPanelButtons } = await import('../../../src/events/interactionCreate/voiceControl');
    const [row1, row2] = createControlPanelButtons();
    expect(row1).toBeDefined();
    expect(row2).toBeDefined();
  });
});
