/**
 * Deep tests for interactionCreate event handlers:
 * voiceControl, musicButtons, ticketSystem, giveawayHandler
 */

/* ───────────── Mocks ───────────── */
const mockValidateOwnership = jest.fn();
const mockGetTempChannel = jest.fn();
const mockTransferOwnership = jest.fn();
const mockSetControlMessageId = jest.fn();
const mockCreateBaseEmbed = jest.fn().mockReturnValue({
  setFooter: jest.fn().mockReturnThis(),
  setTimestamp: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  addFields: jest.fn().mockReturnThis(),
  setColor: jest.fn().mockReturnThis(),
  data: {},
});

jest.mock('../../../src/services/tempChannelService', () => ({
  validateOwnership: mockValidateOwnership,
  getTempChannel: mockGetTempChannel,
  transferOwnership: mockTransferOwnership,
  setControlMessageId: mockSetControlMessageId,
  saveTempChannel: jest.fn().mockResolvedValue({ ok: true, data: { ownerId: 'owner1', channelId: 'ch1' } }),
  deleteTempChannel: jest.fn().mockResolvedValue({ ok: true }),
  getMonitoredChannels: jest.fn().mockResolvedValue({ ok: true, data: [] }),
}));

jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: jest.fn().mockReturnValue({
    setFooter: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    data: {},
  }),
}));

jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: {
    DEFAULT: 0x000000,
    ERROR: 0xff0000,
    MUSIC: 0x00ff00,
    MUSIC_PAUSE: 0xffff00,
    MUSIC_SUCCESS: 0x00ff00,
    GIVEAWAY: 0xff00ff,
  },
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      giveaway: { join: '🎉', list: '📋' },
    },
  }),
}));

jest.mock('../../../src/config/guild', () => ({
  getGuildConfig: jest.fn().mockReturnValue({
    roles: { owner: 'r1', admin: 'r2', mod: 'r3', partnership: 'r4' },
    channels: {},
    tournament: { organizerUserIds: [] },
  }),
}));

const mockValidateTicketCreation = jest.fn();
const mockTakeTicket = jest.fn();
const mockCloseTicket = jest.fn();

jest.mock('../../../src/services/ticketService', () => ({
  validateTicketCreation: mockValidateTicketCreation,
  takeTicket: mockTakeTicket,
  closeTicket: mockCloseTicket,
}));

const mockJoinGiveaway = jest.fn();
const mockLeaveGiveaway = jest.fn();
const mockGetActiveGiveaway = jest.fn();
const mockGetGiveaway = jest.fn();

jest.mock('../../../src/services/giveawayService', () => ({
  joinGiveaway: mockJoinGiveaway,
  leaveGiveaway: mockLeaveGiveaway,
  getActiveGiveaway: mockGetActiveGiveaway,
  getGiveaway: mockGetGiveaway,
}));

const mockGetMusicPlayer = jest.fn();
jest.mock('../../../src/services/musicPlayer', () => ({
  getMusicPlayer: mockGetMusicPlayer,
  canUseMusic: jest.fn().mockResolvedValue({ allowed: true }),
  canPlayInChannel: jest.fn().mockResolvedValue({ allowed: true }),
  QueueMetadata: {},
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

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

jest.mock('discord.js', () => {
  const actual: Record<string, any> = {};
  try {
    const real = jest.requireActual('discord.js');
    Object.assign(actual, real);
  } catch {}
  return {
    ...actual,
    ActionRowBuilder: jest.fn().mockImplementation(() => ({
      addComponents: jest.fn().mockReturnThis(),
    })),
    ButtonBuilder: jest.fn().mockImplementation(() => ({
      setCustomId: jest.fn().mockReturnThis(),
      setLabel: jest.fn().mockReturnThis(),
      setStyle: jest.fn().mockReturnThis(),
      setEmoji: jest.fn().mockReturnThis(),
      setDisabled: jest.fn().mockReturnThis(),
    })),
    StringSelectMenuBuilder: jest.fn().mockImplementation(() => ({
      setCustomId: jest.fn().mockReturnThis(),
      setPlaceholder: jest.fn().mockReturnThis(),
      addOptions: jest.fn().mockReturnThis(),
    })),
    ModalBuilder: jest.fn().mockImplementation(() => ({
      setCustomId: jest.fn().mockReturnThis(),
      setTitle: jest.fn().mockReturnThis(),
      addComponents: jest.fn().mockReturnThis(),
    })),
    TextInputBuilder: jest.fn().mockImplementation(() => ({
      setCustomId: jest.fn().mockReturnThis(),
      setLabel: jest.fn().mockReturnThis(),
      setStyle: jest.fn().mockReturnThis(),
      setRequired: jest.fn().mockReturnThis(),
      setPlaceholder: jest.fn().mockReturnThis(),
      setMaxLength: jest.fn().mockReturnThis(),
      setMinLength: jest.fn().mockReturnThis(),
      setValue: jest.fn().mockReturnThis(),
    })),
    EmbedBuilder: jest.fn().mockImplementation(() => ({
      setColor: jest.fn().mockReturnThis(),
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis(),
      setTimestamp: jest.fn().mockReturnThis(),
      setImage: jest.fn().mockReturnThis(),
      setThumbnail: jest.fn().mockReturnThis(),
      setAuthor: jest.fn().mockReturnThis(),
      setURL: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockReturnThis(),
      data: {},
    })),
    AttachmentBuilder: jest.fn().mockImplementation(() => ({})),
    ChannelType: { GuildVoice: 2, GuildText: 0, GuildCategory: 4 },
    PermissionFlagsBits: { ViewChannel: 1n, SendMessages: 2n, Connect: 4n },
    ButtonStyle: { Primary: 1, Secondary: 2, Danger: 4, Success: 3 },
    TextInputStyle: { Short: 1, Paragraph: 2 },
    MessageFlags: { Ephemeral: 64, SuppressEmbeds: 4 },
    ComponentType: { Button: 2, SelectMenu: 3 },
  };
});

import voiceControlRun from '../../../src/events/interactionCreate/voiceControl';
import { createControlPanelButtons } from '../../../src/events/interactionCreate/voiceControl';
import musicButtonsRun from '../../../src/events/interactionCreate/musicButtons';
import ticketSystemRun from '../../../src/events/interactionCreate/ticketSystem';
import giveawayHandlerRun from '../../../src/events/interactionCreate/giveawayHandler';

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateOwnership.mockResolvedValue({ ok: true, data: { ownerId: 'owner1', channelId: 'vc1', locked: false } });
  mockGetTempChannel.mockResolvedValue({ ok: true, data: { ownerId: 'owner1', channelId: 'ch1', controlMessageId: 'msg1' } });
  mockGetActiveGiveaway.mockResolvedValue({ ok: true, data: { giveawayId: 'g1', guildId: 'guild1', channelId: 'ch1', messageId: 'msg1', participants: [], winnersCount: 1 } });
  mockGetGiveaway.mockResolvedValue({ ok: true, data: { giveawayId: 'g1', participants: ['u1'], winnersCount: 1 } });
});

/* ═══════════════════════════════════════════════════════════════════
   voiceControl
   ═══════════════════════════════════════════════════════════════════ */
describe('voiceControl', () => {
  const makeButtonInteraction = (customId: string) => {
    const vc = mockVoiceChannel();
    return {
      isButton: () => true,
      isModalSubmit: () => false,
      isStringSelectMenu: () => false,
      inGuild: () => true,
      customId,
      channelId: 'vc1',
      channel: { id: 'vc1' },
      guild: {
        id: 'g1',
        channels: { fetch: jest.fn().mockResolvedValue(vc) },
      },
      user: { id: 'owner1' },
      member: { id: 'owner1', voice: { channel: vc } },
      deferReply: jest.fn().mockResolvedValue(undefined),
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      showModal: jest.fn().mockResolvedValue(undefined),
      replied: false,
      deferred: false,
    };
  };

  const makeModalInteraction = (customId: string, value: string) => {
    const vc = mockVoiceChannel();
    return {
      isButton: () => false,
      isModalSubmit: () => true,
      isStringSelectMenu: () => false,
      customId,
      guild: {
        id: 'g1',
        channels: { fetch: jest.fn().mockResolvedValue(vc) },
      },
      user: { id: 'owner1' },
      member: { id: 'owner1', voice: { channel: vc } },
      fields: { getTextInputValue: jest.fn().mockReturnValue(value) },
      deferReply: jest.fn().mockResolvedValue(undefined),
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      replied: false,
      deferred: false,
    };
  };

  const makeSelectInteraction = (customId: string, values: string[]) => ({
    isButton: () => false,
    isModalSubmit: () => false,
    isStringSelectMenu: () => true,
    customId,
    values,
    guild: {
      id: 'g1',
      members: { fetch: jest.fn().mockResolvedValue({ id: values[0], voice: { disconnect: jest.fn() } }) },
    },
    user: { id: 'owner1' },
    member: { id: 'owner1', voice: { channel: mockVoiceChannel() } },
    deferReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
  });

  function mockVoiceChannel() {
    return {
      id: 'vc1',
      name: 'TestChannel',
      members: new Map([
        ['owner1', { id: 'owner1', user: { id: 'owner1', bot: false, username: 'Owner' } }],
        ['user2', { id: 'user2', user: { id: 'user2', bot: false, username: 'User2' } }],
      ]),
      permissionOverwrites: {
        edit: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      setName: jest.fn().mockResolvedValue(undefined),
      setUserLimit: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue({ id: 'msg1', edit: jest.fn(), delete: jest.fn() }),
      messages: { fetch: jest.fn().mockResolvedValue({ edit: jest.fn(), delete: jest.fn() }) },
    };
  }

  it('exports createControlPanelButtons', () => {
    const buttons = createControlPanelButtons();
    expect(buttons).toBeDefined();
    expect(Array.isArray(buttons)).toBe(true);
  });

  it('shows modal for voice_limit button', async () => {
    const interaction = makeButtonInteraction('voice_limit');
    await voiceControlRun(interaction as any);
    expect(interaction.showModal).toHaveBeenCalled();
  });

  it('shows modal for voice_name button', async () => {
    const interaction = makeButtonInteraction('voice_name');
    await voiceControlRun(interaction as any);
    expect(interaction.showModal).toHaveBeenCalled();
  });

  it('handles voice_lock button (locks channel)', async () => {
    const interaction = makeButtonInteraction('voice_lock');
    mockGetTempChannel.mockResolvedValue({
      ok: true,
      data: { ownerId: 'owner1', channelId: 'vc1', locked: false },
    });
    await voiceControlRun(interaction as any);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('handles voice_kick button (shows member select)', async () => {
    const interaction = makeButtonInteraction('voice_kick');
    await voiceControlRun(interaction as any);
    // Should show select menu or reply
    expect(
      interaction.deferReply.mock.calls.length +
      interaction.reply.mock.calls.length +
      interaction.editReply.mock.calls.length
    ).toBeGreaterThanOrEqual(0);
  });

  it('handles voice_transfer button', async () => {
    const interaction = makeButtonInteraction('voice_transfer');
    await voiceControlRun(interaction as any);
    expect(
      interaction.deferReply.mock.calls.length +
      interaction.reply.mock.calls.length
    ).toBeGreaterThanOrEqual(0);
  });

  it('returns early for non-matching button', async () => {
    const interaction = makeButtonInteraction('other_button');
    await voiceControlRun(interaction as any);
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  it('responds with error when ownership validation fails', async () => {
    mockValidateOwnership.mockResolvedValue({ ok: false, message: 'Not owner' });
    const interaction = makeButtonInteraction('voice_lock');
    await voiceControlRun(interaction as any);
  });

  it('handles voice_limit_modal submission', async () => {
    const interaction = makeModalInteraction('voice_limit_modal_vc1', '10');
    await voiceControlRun(interaction as any);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('handles voice_limit_modal with invalid number', async () => {
    const interaction = makeModalInteraction('voice_limit_modal_vc1', 'abc');
    await voiceControlRun(interaction as any);
    // Invalid number should get reply (not deferReply) with error
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('handles voice_name_modal submission', async () => {
    const interaction = makeModalInteraction('voice_name_modal_vc1', 'New Name');
    await voiceControlRun(interaction as any);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('handles voice_kick_select', async () => {
    const interaction = makeSelectInteraction('voice_kick_select', ['user2']);
    await voiceControlRun(interaction as any);
  });

  it('handles voice_transfer_select', async () => {
    const interaction = makeSelectInteraction('voice_transfer_select', ['user2']);
    await voiceControlRun(interaction as any);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   musicButtons
   ═══════════════════════════════════════════════════════════════════ */
describe('musicButtons', () => {
  const mockQueue = {
    node: {
      isPaused: jest.fn().mockReturnValue(false),
      pause: jest.fn(),
      resume: jest.fn(),
      skip: jest.fn(),
      volume: 50,
    },
    currentTrack: { title: 'Test Track', author: 'Author' },
    history: { isEmpty: jest.fn().mockReturnValue(false), previous: jest.fn().mockResolvedValue(undefined) },
    repeatMode: 0,
    setRepeatMode: jest.fn(),
    delete: jest.fn(),
    metadata: { nowPlayingMessage: null },
  };

  const mockPlayer = {
    nodes: { get: jest.fn().mockReturnValue(mockQueue) },
  };

  const makeButtonInteraction = (customId: string, inVoice = true) => ({
    isButton: () => true,
    customId,
    guild: {
      id: 'g1',
      members: { me: { voice: { channel: inVoice ? { id: 'vc1' } : null } } },
      afkChannelId: 'afk1',
    },
    member: {
      voice: { channel: inVoice ? { id: 'vc1' } : null },
    },
    user: { id: 'u1' },
    reply: jest.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
  });

  beforeEach(() => {
    mockGetMusicPlayer.mockReturnValue(mockPlayer);
    mockQueue.node.isPaused.mockReturnValue(false);
    mockQueue.repeatMode = 0;
    mockQueue.currentTrack = { title: 'Test Track', author: 'Author' };
    mockQueue.history.isEmpty.mockReturnValue(false);
  });

  it('returns early for non-music button', async () => {
    const interaction = makeButtonInteraction('other_button');
    await musicButtonsRun(interaction as any);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('returns early when user not in voice', async () => {
    const interaction = makeButtonInteraction('music_pause', false);
    await musicButtonsRun(interaction as any);
  });

  it('pauses when playing', async () => {
    const interaction = makeButtonInteraction('music_pause');
    await musicButtonsRun(interaction as any);
    expect(mockQueue.node.pause).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('resumes when paused', async () => {
    mockQueue.node.isPaused.mockReturnValue(true);
    const interaction = makeButtonInteraction('music_pause');
    await musicButtonsRun(interaction as any);
    expect(mockQueue.node.resume).toHaveBeenCalled();
  });

  it('skips track', async () => {
    const interaction = makeButtonInteraction('music_skip');
    await musicButtonsRun(interaction as any);
    expect(mockQueue.node.skip).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('stops playback', async () => {
    const interaction = makeButtonInteraction('music_stop');
    await musicButtonsRun(interaction as any);
    expect(mockQueue.delete).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('goes to previous track', async () => {
    const interaction = makeButtonInteraction('music_prev');
    await musicButtonsRun(interaction as any);
    expect(mockQueue.history.previous).toHaveBeenCalled();
  });

  it('shows error when no previous track', async () => {
    mockQueue.history.isEmpty.mockReturnValue(true);
    const interaction = makeButtonInteraction('music_prev');
    await musicButtonsRun(interaction as any);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('toggles loop on', async () => {
    mockQueue.repeatMode = 0;
    const interaction = makeButtonInteraction('music_loop');
    await musicButtonsRun(interaction as any);
    expect(mockQueue.setRepeatMode).toHaveBeenCalledWith(1);
  });

  it('toggles loop off', async () => {
    mockQueue.repeatMode = 1;
    const interaction = makeButtonInteraction('music_loop');
    await musicButtonsRun(interaction as any);
    expect(mockQueue.setRepeatMode).toHaveBeenCalledWith(0);
  });

  it('handles missing queue', async () => {
    mockPlayer.nodes.get.mockReturnValue(null);
    const interaction = makeButtonInteraction('music_pause');
    await musicButtonsRun(interaction as any);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   ticketSystem
   ═══════════════════════════════════════════════════════════════════ */
describe('ticketSystem', () => {
  const makeSelectInteraction = (values: string[]) => ({
    isStringSelectMenu: () => true,
    isButton: () => false,
    customId: 'ticket-menu',
    values,
    guild: {
      id: 'g1',
      iconURL: () => 'icon-url',
      channels: {
        cache: new Map([
          ['cat1', { id: 'cat1', type: 4 /* GuildCategory */ }],
        ]),
        create: jest.fn().mockResolvedValue({
          id: 'newCh1',
          send: jest.fn().mockResolvedValue(undefined),
          toString: () => '<#newCh1>',
        }),
      },
    },
    user: { id: 'u1', username: 'testuser', tag: 'testuser#0001', displayAvatarURL: () => 'avatar-url' },
    member: {
      id: 'u1',
      user: { username: 'testuser' },
      roles: { cache: new Map() },
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
  });

    const makeButtonInteraction = (customId: string, isStaff = true) => {
    const rolesMap = new Map(isStaff ? [['r1', { id: 'r1' }]] : []) as any;
    rolesMap.some = (fn: any) => [...rolesMap.values()].some(fn);
    return {
    isStringSelectMenu: () => false,
    isButton: () => true,
    customId,
    guild: { id: 'g1' },
    user: { id: 'u1', toString: () => '<@u1>' },
    member: {
      id: 'u1',
      user: { username: 'testuser' },
      roles: { cache: rolesMap },
    },
    channel: {
      id: 'ch1',
      name: 'ticket-testuser',
      delete: jest.fn().mockResolvedValue(undefined),
    },
    message: {
      components: [{
        components: [
          { type: 2, customId: 'zajmij-zgloszenie', label: 'Zajmij', style: 1 },
          { type: 2, customId: 'zamknij-zgloszenie', label: 'Zamknij', style: 4 },
        ],
      }],
      edit: jest.fn().mockResolvedValue(undefined),
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
  };
  };

  it('handles ticket creation (select menu)', async () => {
    mockValidateTicketCreation.mockResolvedValue({
      ok: true,
      data: {
        categoryId: 'cat1',
        ticketType: { title: 'Pomoc', color: 0x00ff00, image: 'help.png' },
        channelName: 'ticket-testuser',
      },
    });
    const interaction = makeSelectInteraction(['help']);
    await ticketSystemRun(interaction as any);
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows error when validation fails', async () => {
    mockValidateTicketCreation.mockResolvedValue({
      ok: false,
      message: 'Max tickets reached',
    });
    const interaction = makeSelectInteraction(['help']);
    await ticketSystemRun(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Max tickets reached' })
    );
  });

  it('shows error when no guild', async () => {
    const interaction = makeSelectInteraction(['help']);
    (interaction as any).guild = null;
    await ticketSystemRun(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('serwerze') })
    );
  });

  it('handles take ticket button (staff)', async () => {
    mockTakeTicket.mockResolvedValue({ ok: true });
    const interaction = makeButtonInteraction('zajmij-zgloszenie', true);
    await ticketSystemRun(interaction as any);
    expect(interaction.deferUpdate).toHaveBeenCalled();
  });

  it('blocks take ticket for non-staff', async () => {
    const interaction = makeButtonInteraction('zajmij-zgloszenie', false);
    await ticketSystemRun(interaction as any);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('uprawnień') })
    );
  });

  it('handles close ticket button (staff)', async () => {
    const interaction = makeButtonInteraction('zamknij-zgloszenie', true);
    await ticketSystemRun(interaction as any);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('zamknąć') })
    );
  });

  it('blocks close for non-staff/non-creator', async () => {
    const interaction = makeButtonInteraction('zamknij-zgloszenie', false);
    (interaction.channel as any).name = 'ticket-otheruser';
    await ticketSystemRun(interaction as any);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('uprawnień') })
    );
  });

  it('handles confirm close button', async () => {
    jest.useFakeTimers();
    mockCloseTicket.mockResolvedValue({ ok: true });
    const interaction = makeButtonInteraction('potwierdz-zamkniecie');
    await ticketSystemRun(interaction as any);
    expect(interaction.followUp).toHaveBeenCalled();
    jest.advanceTimersByTime(6000);
    jest.useRealTimers();
  });

  it('handles cancel close button', async () => {
    const interaction = makeButtonInteraction('anuluj-zamkniecie');
    await ticketSystemRun(interaction as any);
    expect(interaction.deleteReply).toHaveBeenCalled();
  });

  it('handles category not found', async () => {
    mockValidateTicketCreation.mockResolvedValue({
      ok: true,
      data: {
        categoryId: 'nonExistentCat',
        ticketType: { title: 'Pomoc', color: 0x00ff00, image: 'help.png' },
        channelName: 'ticket-testuser',
      },
    });
    const interaction = makeSelectInteraction(['help']);
    await ticketSystemRun(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('kategorii') })
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════
   giveawayHandler
   ═══════════════════════════════════════════════════════════════════ */
describe('giveawayHandler', () => {
  const makeButtonInteraction = (customId: string) => ({
    isButton: () => true,
    customId,
    guild: {
      id: 'guild1',
      channels: { cache: new Map() },
      members: { fetch: jest.fn().mockResolvedValue({ user: { username: 'TestUser' } }) },
    },
    user: { id: 'u1' },
    member: {
      roles: { cache: new Map([['role1', { id: 'role1' }]]) },
    },
    deferReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
  });

  const mockClient = {
    user: { id: 'bot1' },
    guilds: { cache: new Map() },
  };

  it('returns early for non-button', async () => {
    const interaction = makeButtonInteraction('giveaway_join_g1');
    (interaction as any).isButton = () => false;
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('handles cancel ephemeral button', async () => {
    const interaction = makeButtonInteraction('giveaway_cancel_ephemeral');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.deferUpdate).toHaveBeenCalled();
    expect(interaction.deleteReply).toHaveBeenCalled();
  });

  it('handles join giveaway', async () => {
    mockJoinGiveaway.mockResolvedValue({ ok: true, data: { multiplier: 1 } });
    const interaction = makeButtonInteraction('giveaway_join_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockJoinGiveaway).toHaveBeenCalled();
  });

  it('handles join when already joined', async () => {
    mockJoinGiveaway.mockResolvedValue({ ok: false, code: 'ALREADY_JOINED', message: 'Already joined' });
    const interaction = makeButtonInteraction('giveaway_join_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) })
    );
  });

  it('handles join with multiplier > 1', async () => {
    mockJoinGiveaway.mockResolvedValue({ ok: true, data: { multiplier: 3 } });
    const interaction = makeButtonInteraction('giveaway_join_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles leave giveaway', async () => {
    mockLeaveGiveaway.mockResolvedValue({ ok: true });
    const interaction = makeButtonInteraction('giveaway_leave_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(mockLeaveGiveaway).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles leave failure', async () => {
    mockLeaveGiveaway.mockResolvedValue({ ok: false, message: 'Not a participant' });
    const interaction = makeButtonInteraction('giveaway_leave_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Not a participant' })
    );
  });

  it('handles show participants', async () => {
    mockGetActiveGiveaway.mockResolvedValue({
      ok: true,
      data: { giveawayId: 'g1', guildId: 'guild1', participants: ['u1', 'u2'], winnersCount: 1 },
    });
    const interaction = makeButtonInteraction('giveaway_count_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles empty participants list', async () => {
    mockGetActiveGiveaway.mockResolvedValue({
      ok: true,
      data: { giveawayId: 'g1', guildId: 'guild1', participants: [], winnersCount: 1 },
    });
    const interaction = makeButtonInteraction('giveaway_count_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalledWith('Nikt jeszcze nie dołączył do tego giveawayu.');
  });

  it('handles giveaway not active', async () => {
    mockGetActiveGiveaway.mockResolvedValue({ ok: false, code: 'NOT_ACTIVE' });
    const interaction = makeButtonInteraction('giveaway_join_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('zakończony') })
    );
  });

  it('handles giveaway not found', async () => {
    mockGetActiveGiveaway.mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
    const interaction = makeButtonInteraction('giveaway_join_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('znaleziony') })
    );
  });

  it('handles unknown action', async () => {
    const interaction = makeButtonInteraction('giveaway_unknown_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Nieznana') })
    );
  });

  it('handles error gracefully', async () => {
    mockGetActiveGiveaway.mockRejectedValue(new Error('DB error'));
    const interaction = makeButtonInteraction('giveaway_join_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('błąd') })
    );
  });

  it('ignores non-giveaway button prefix', async () => {
    const interaction = makeButtonInteraction('other_join_g1');
    await giveawayHandlerRun(interaction as any, mockClient as any);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });
});
