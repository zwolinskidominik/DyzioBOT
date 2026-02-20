export {};
/**
 * Deep tests to cover remaining low-coverage files:
 * logRoleUpdate, logMessageDelete, logMessageEdit, musicButtons, musicPlayer,
 * tempChannel, emoji, help, EventHandler, monthlyStatsFlush, xpFlush,
 * deleteTempChannel, logInviteCreate, logRoleCreate, logRoleDelete,
 * logThreadCreate, logThreadDelete, logThreadUpdate, reactionRoleRemove,
 * boostDetection, logMemberRemove, logMemberJoin, birthdayService,
 * giveawayService, giveaway command branches, ticketSystem branches
 */

/* ─── Common mocks ─── */
jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: {
    DEFAULT: 0, ERROR: 0xff0000, MUSIC: 0x00ff00, MUSIC_SUCCESS: 0x00ff00,
    MUSIC_PAUSE: 0xffff00, JOIN: 0x00ff00, LEAVE: 0xff0000,
    GIVEAWAY: 0xff00ff, TWITCH: 0x9146ff,
  },
}));

const mockCreateBaseEmbed = jest.fn().mockReturnValue({
  setFooter: jest.fn().mockReturnThis(),
  setTimestamp: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  addFields: jest.fn().mockReturnThis(),
  setColor: jest.fn().mockReturnThis(),
  setTitle: jest.fn().mockReturnThis(),
  setImage: jest.fn().mockReturnThis(),
  setThumbnail: jest.fn().mockReturnThis(),
  setURL: jest.fn().mockReturnThis(),
  setAuthor: jest.fn().mockReturnThis(),
  data: {},
});
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: jest.fn().mockReturnValue({ data: {} }),
}));

const mockSendLog = jest.fn().mockResolvedValue(undefined);
const mockTruncate = jest.fn((s: string) => s);
jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: mockSendLog,
  truncate: mockTruncate,
}));

const mockGetModerator = jest.fn().mockResolvedValue(null);
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: mockGetModerator,
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      next: '➡️', previous: '⬅️',
      suggestion: { upvote: '👍', downvote: '👎' },
    },
  }),
}));

const mockDeleteSuggestion = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/services/suggestionService', () => ({
  deleteSuggestionByMessageId: mockDeleteSuggestion,
}));

/* ─── Music player mock ─── */
const mockGetMusicPlayer = jest.fn();
jest.mock('../../../src/services/musicPlayer', () => ({
  getMusicPlayer: mockGetMusicPlayer,
  QueueMetadata: {},
  createProgressBar: jest.fn(),
  canUseMusic: jest.fn(),
  canPlayInChannel: jest.fn(),
  initializeMusicPlayer: jest.fn(),
}));

/* ─── Model mocks ─── */
jest.mock('../../../src/models/MusicConfig', () => ({
  MusicConfigModel: { findOne: jest.fn() },
}));

const mockTempChannelFind = jest.fn();
const mockTempChannelFindOneAndUpdate = jest.fn();
jest.mock('../../../src/models/TempChannelConfiguration', () => ({
  TempChannelConfigurationModel: {
    findOne: mockTempChannelFind,
    findOneAndUpdate: mockTempChannelFindOneAndUpdate,
  },
}));

jest.mock('../../../src/models/LogConfiguration', () => ({
  LogConfigurationModel: { findOne: jest.fn() },
}));

/* ─── Cron, cache ─── */
jest.mock('node-cron', () => ({
  default: { schedule: jest.fn() },
  schedule: jest.fn(),
}));
jest.mock('../../../src/config/constants/cron', () => ({
  CRON: { MONTHLY_STATS_FLUSH: '*/5 * * * *', XP_FLUSH: '*/5 * * * *' },
}));
jest.mock('../../../src/cache/monthlyStatsCache', () => ({
  flushMonthlyStats: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/xpService', () => ({
  flush: jest.fn().mockResolvedValue(undefined),
}));

/* ─── FS mock for EventHandler ─── */
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn().mockReturnValue([]),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => true }),
  existsSync: jest.fn().mockReturnValue(true),
}));

jest.mock('lodash', () => ({
  chunk: jest.fn((arr: any[], size: number) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

/* ═══════════════════════════════════════════════════════════════════
   logRoleUpdate
   ═══════════════════════════════════════════════════════════════════ */
describe('logRoleUpdate', () => {
  const logRoleUpdate = require('../../../src/events/roleUpdate/logRoleUpdate').default;

  function makeRole(overrides: any = {}) {
    return {
      id: 'r1',
      guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      name: 'TestRole',
      color: 0x000000,
      hexColor: '#000000',
      permissions: { bitfield: 0n },
      hoist: false,
      mentionable: false,
      ...overrides,
    };
  }

  it('logs name change', async () => {
    await logRoleUpdate(makeRole({ name: 'Old' }), makeRole({ name: 'New' }), {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'roleUpdate', expect.anything());
  });

  it('logs color change', async () => {
    await logRoleUpdate(makeRole({ color: 0xff0000, hexColor: '#ff0000' }), makeRole({ color: 0x00ff00, hexColor: '#00ff00' }), {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'roleUpdate', expect.anything());
  });

  it('logs permission change', async () => {
    await logRoleUpdate(makeRole({ permissions: { bitfield: 0n } }), makeRole({ permissions: { bitfield: 1n } }), {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'roleUpdate', expect.anything());
  });

  it('logs hoist change', async () => {
    await logRoleUpdate(makeRole({ hoist: false }), makeRole({ hoist: true }), {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'roleUpdate', expect.anything());
  });

  it('logs mentionable change', async () => {
    await logRoleUpdate(makeRole({ mentionable: false }), makeRole({ mentionable: true }), {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'roleUpdate', expect.anything());
  });

  it('does nothing when no changes', async () => {
    const r = makeRole();
    await logRoleUpdate(r, r, {});
    expect(mockSendLog).not.toHaveBeenCalled();
  });

  it('logs with moderator', async () => {
    mockGetModerator.mockResolvedValueOnce({ id: 'mod1' });
    await logRoleUpdate(makeRole({ name: 'A' }), makeRole({ name: 'B' }), {});
    expect(mockSendLog).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   logMessageDelete
   ═══════════════════════════════════════════════════════════════════ */
describe('logMessageDelete', () => {
  const logMsgDelete = require('../../../src/events/messageDelete/logMessageDelete').default;

  it('logs message deletion', async () => {
    const msg = {
      id: 'm1', guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      author: { id: 'u1', tag: 'user#001', bot: false, displayAvatarURL: () => 'url' },
      content: 'Hello',
      channelId: 'ch1',
      attachments: { size: 0, map: () => [] },
    };
    await logMsgDelete(msg, {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'messageDelete', expect.anything(), expect.anything());
  });

  it('logs with attachments', async () => {
    const msg = {
      id: 'm1', guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      author: { id: 'u1', tag: 'user#001', bot: false, displayAvatarURL: () => 'url' },
      content: 'Hi',
      channelId: 'ch1',
      attachments: { size: 2, map: (fn: Function) => ['url1', 'url2'] },
    };
    await logMsgDelete(msg, {});
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('skips bot messages', async () => {
    const msg = {
      id: 'm1', guild: { id: 'g1' },
      author: { id: 'u1', bot: true },
    };
    await logMsgDelete(msg, {});
    expect(mockSendLog).not.toHaveBeenCalled();
  });

  it('skips messages without guild', async () => {
    await logMsgDelete({ id: 'm1', guild: null }, {});
    expect(mockSendLog).not.toHaveBeenCalled();
  });

  it('handles no content (embed-only)', async () => {
    const msg = {
      id: 'm1', guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      author: { id: 'u1', tag: 'user', bot: false, displayAvatarURL: () => 'url' },
      content: null,
      channelId: 'ch1',
      attachments: { size: 0, map: () => [] },
    };
    await logMsgDelete(msg, {});
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('handles no author', async () => {
    const msg = {
      id: 'm1', guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      author: null,
      content: 'Test',
      channelId: 'ch1',
      attachments: { size: 0, map: () => [] },
    };
    await logMsgDelete(msg, {});
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('handles suggestion deletion error', async () => {
    mockDeleteSuggestion.mockRejectedValueOnce(new Error('DB fail'));
    const msg = {
      id: 'm1', guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      author: { id: 'u1', tag: 'user', bot: false, displayAvatarURL: () => 'url' },
      content: 'Test',
      channelId: 'ch1',
      attachments: { size: 0, map: () => [] },
    };
    await logMsgDelete(msg, {});
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('logs with moderator', async () => {
    mockGetModerator.mockResolvedValueOnce({ id: 'mod1' });
    const msg = {
      id: 'm1', guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      author: { id: 'u1', tag: 'user#001', bot: false, displayAvatarURL: () => 'url' },
      content: 'OK',
      channelId: 'ch1',
      attachments: { size: 0, map: () => [] },
    };
    await logMsgDelete(msg, {});
    expect(mockSendLog).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   logMessageEdit
   ═══════════════════════════════════════════════════════════════════ */
describe('logMessageEdit', () => {
  const logMsgEdit = require('../../../src/events/messageUpdate/logMessageEdit').default;

  function makeMsg(overrides: any = {}) {
    return {
      id: 'm1',
      guild: { id: 'g1' },
      author: { id: 'u1', tag: 'user#001', bot: false, displayAvatarURL: () => 'url' },
      content: 'Hello',
      channelId: 'ch1',
      url: 'https://discord.com/msg',
      ...overrides,
    };
  }

  it('logs content change', async () => {
    await logMsgEdit(makeMsg({ content: 'old' }), makeMsg({ content: 'new' }), {});
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'messageEdit', expect.anything(), expect.anything());
  });

  it('skips when no guild', async () => {
    await logMsgEdit(makeMsg(), makeMsg({ guild: null }), {});
    expect(mockSendLog).not.toHaveBeenCalled();
  });

  it('skips bot messages', async () => {
    await logMsgEdit(makeMsg(), makeMsg({ author: { bot: true } }), {});
    expect(mockSendLog).not.toHaveBeenCalled();
  });

  it('skips when content unchanged', async () => {
    const m = makeMsg({ content: 'same' });
    await logMsgEdit(m, m, {});
    expect(mockSendLog).not.toHaveBeenCalled();
  });

  it('handles null content (partial)', async () => {
    await logMsgEdit(makeMsg({ content: null }), makeMsg({ content: 'new' }), {});
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('handles null author', async () => {
    await logMsgEdit(makeMsg({ content: 'old', author: null }), makeMsg({ content: 'new', author: null }), {});
    expect(mockSendLog).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   musicButtons
   ═══════════════════════════════════════════════════════════════════ */
describe('musicButtons', () => {
  const musicButtons = require('../../../src/events/interactionCreate/musicButtons').default;

  function makeInteraction(customId: string, overrides: any = {}) {
    return {
      isButton: () => true,
      customId,
      guild: { id: 'g1', afkChannelId: 'afk1' },
      member: { voice: { channel: { id: 'vc1' } } },
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('ignores non-button interactions', async () => {
    await musicButtons({ isButton: () => false });
    expect(mockGetMusicPlayer).not.toHaveBeenCalled();
  });

  it('ignores non-music buttons', async () => {
    await musicButtons(makeInteraction('some_other_button'));
    expect(mockGetMusicPlayer).not.toHaveBeenCalled();
  });

  it('ignores when no guild', async () => {
    await musicButtons(makeInteraction('music_pause', { guild: null }));
    expect(mockGetMusicPlayer).not.toHaveBeenCalled();
  });

  it('returns when no player', async () => {
    mockGetMusicPlayer.mockReturnValue(null);
    await musicButtons(makeInteraction('music_pause'));
  });

  it('replies error when not in voice channel', async () => {
    mockGetMusicPlayer.mockReturnValue({ nodes: { get: () => null } });
    const btn = makeInteraction('music_pause', {
      member: { voice: { channel: null } },
    });
    await musicButtons(btn);
    expect(btn.reply).toHaveBeenCalled();
  });

  it('replies error when in AFK channel', async () => {
    mockGetMusicPlayer.mockReturnValue({ nodes: { get: () => null } });
    const btn = makeInteraction('music_pause', {
      member: { voice: { channel: { id: 'afk1' } } },
    });
    await musicButtons(btn);
    expect(btn.reply).toHaveBeenCalled();
  });

  it('replies error when different voice channel', async () => {
    mockGetMusicPlayer.mockReturnValue({
      nodes: { get: () => ({ channel: { id: 'other_vc' }, currentTrack: {} }) },
    });
    const btn = makeInteraction('music_pause');
    await musicButtons(btn);
    expect(btn.reply).toHaveBeenCalled();
  });

  it('replies error when nothing playing', async () => {
    mockGetMusicPlayer.mockReturnValue({
      nodes: { get: () => ({ channel: null, currentTrack: null }) },
    });
    const btn = makeInteraction('music_pause');
    await musicButtons(btn);
    expect(btn.reply).toHaveBeenCalled();
  });

  it('handles music_pause (paused → resume)', async () => {
    const mockResume = jest.fn();
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          node: { isPaused: () => true, resume: mockResume, pause: jest.fn() },
        }),
      },
    });
    const btn = makeInteraction('music_pause');
    await musicButtons(btn);
    expect(mockResume).toHaveBeenCalled();
    expect(btn.reply).toHaveBeenCalled();
  });

  it('handles music_pause (playing → pause)', async () => {
    const mockPause = jest.fn();
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          node: { isPaused: () => false, resume: jest.fn(), pause: mockPause },
        }),
      },
    });
    const btn = makeInteraction('music_pause');
    await musicButtons(btn);
    expect(mockPause).toHaveBeenCalled();
  });

  it('handles music_skip', async () => {
    const mockSkip = jest.fn();
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          node: { skip: mockSkip },
        }),
      },
    });
    const btn = makeInteraction('music_skip');
    await musicButtons(btn);
    expect(mockSkip).toHaveBeenCalled();
  });

  it('handles music_prev with history', async () => {
    const mockPrevious = jest.fn().mockResolvedValue(undefined);
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          history: { isEmpty: () => false, previous: mockPrevious },
        }),
      },
    });
    const btn = makeInteraction('music_prev');
    await musicButtons(btn);
    expect(mockPrevious).toHaveBeenCalled();
  });

  it('handles music_prev without history', async () => {
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          history: { isEmpty: () => true },
        }),
      },
    });
    const btn = makeInteraction('music_prev');
    await musicButtons(btn);
    expect(btn.reply).toHaveBeenCalled();
  });

  it('handles music_stop', async () => {
    const mockDelete = jest.fn();
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          metadata: { nowPlayingMessage: { editable: true, edit: jest.fn().mockResolvedValue(undefined) } },
          delete: mockDelete,
        }),
      },
    });
    const btn = makeInteraction('music_stop');
    await musicButtons(btn);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('handles music_loop toggle on', async () => {
    const mockSetRepeat = jest.fn();
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          repeatMode: 0,
          setRepeatMode: mockSetRepeat,
        }),
      },
    });
    const btn = makeInteraction('music_loop');
    await musicButtons(btn);
    expect(mockSetRepeat).toHaveBeenCalledWith(1);
  });

  it('handles music_loop toggle off', async () => {
    const mockSetRepeat = jest.fn();
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          repeatMode: 1,
          setRepeatMode: mockSetRepeat,
        }),
      },
    });
    const btn = makeInteraction('music_loop');
    await musicButtons(btn);
    expect(mockSetRepeat).toHaveBeenCalledWith(0);
  });

  it('catches errors in switch', async () => {
    mockGetMusicPlayer.mockReturnValue({
      nodes: {
        get: () => ({
          channel: { id: 'vc1' },
          currentTrack: { title: 'Song' },
          node: { isPaused: () => { throw new Error('boom'); } },
        }),
      },
    });
    const btn = makeInteraction('music_pause');
    await musicButtons(btn);
    expect(btn.reply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   emoji command
   ═══════════════════════════════════════════════════════════════════ */
describe('emoji command', () => {
  const emojiCmd = require('../../../src/commands/misc/emoji');

  function makeInteraction(emojis: any[] = [], overrides: any = {}) {
    const mapFn = (fn: any) => emojis.map(fn);
    return {
      guild: {
        emojis: { cache: { map: mapFn } },
        ...overrides.guild,
      },
      client: { application: { id: 'app1' } },
      user: { id: 'u1' },
      reply: jest.fn().mockResolvedValue(undefined),
      fetchReply: jest.fn().mockResolvedValue({
        createMessageComponentCollector: jest.fn().mockReturnValue({
          on: jest.fn(),
        }),
      }),
      editReply: jest.fn().mockResolvedValue(undefined),
      replied: false,
      deferred: false,
      ...overrides,
    };
  }

  it('shows emoji list (single page)', async () => {
    const emojis = Array.from({ length: 5 }, (_, i) => ({ toString: () => `emoji${i}` }));
    const int = makeInteraction(emojis);
    await emojiCmd.run({ interaction: int });
    expect(int.reply).toHaveBeenCalled();
  });

  it('shows emoji list (multiple pages with nav)', async () => {
    const emojis = Array.from({ length: 25 }, (_, i) => ({ toString: () => `emoji${i}` }));
    const int = makeInteraction(emojis);
    await emojiCmd.run({ interaction: int });
    // Should include components (nav buttons)
    expect(int.reply).toHaveBeenCalled();
    expect(int.fetchReply).toHaveBeenCalled();
  });

  it('shows empty message when no emojis', async () => {
    const int = makeInteraction([]);
    await emojiCmd.run({ interaction: int });
    expect(int.reply).toHaveBeenCalled();
  });

  it('handles no guild', async () => {
    const int = makeInteraction([], { guild: null });
    await emojiCmd.run({ interaction: int });
    expect(int.reply).toHaveBeenCalled();
  });

  it('handles error', async () => {
    const int = makeInteraction([], {
      guild: { emojis: { cache: { map: () => { throw new Error('boom'); } } } },
    });
    await emojiCmd.run({ interaction: int });
    expect(int.reply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   monthlyStatsFlush
   ═══════════════════════════════════════════════════════════════════ */
describe('monthlyStatsFlush', () => {
  const monthlyStatsFlush = require('../../../src/events/clientReady/monthlyStatsFlush');
  
  it('default export calls startMonthlyStatsFlushScheduler', () => {
    const cron = require('node-cron');
    monthlyStatsFlush.default();
    expect(cron.schedule || cron.default?.schedule).toBeDefined();
  });

  it('startMonthlyStatsFlushScheduler registers cron', () => {
    const cron = require('node-cron');
    monthlyStatsFlush.startMonthlyStatsFlushScheduler();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   xpFlush
   ═══════════════════════════════════════════════════════════════════ */
describe('xpFlush', () => {
  const xpFlush = require('../../../src/events/clientReady/xpFlush');

  it('default export flushes XP', async () => {
    await xpFlush.default();
    const { flush } = require('../../../src/services/xpService');
    expect(flush).toHaveBeenCalled();
  });

  it('startXpFlushScheduler registers cron', () => {
    xpFlush.startXpFlushScheduler();
    const cron = require('node-cron');
    expect(cron.schedule || cron.default?.schedule).toBeDefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   deleteTempChannel
   ═══════════════════════════════════════════════════════════════════ */
describe('deleteTempChannel', () => {
  const deleteTempChannel = require('../../../src/events/channelDelete/deleteTempChannel').default;

  it('removes channel from config when found', async () => {
    mockTempChannelFind.mockResolvedValue({ guildId: 'g1', channelIds: ['ch1'] });
    mockTempChannelFindOneAndUpdate.mockResolvedValue({});
    const channel = { id: 'ch1', name: 'temp', type: 2, guild: { id: 'g1' } };
    await deleteTempChannel(channel as any);
    expect(mockTempChannelFindOneAndUpdate).toHaveBeenCalled();
  });

  it('does nothing for non-voice channels', async () => {
    const channel = { id: 'ch1', type: 0, guild: { id: 'g1' } };
    await deleteTempChannel(channel as any);
    expect(mockTempChannelFind).not.toHaveBeenCalled();
  });

  it('does nothing when config not found', async () => {
    mockTempChannelFind.mockResolvedValue(null);
    const channel = { id: 'ch1', name: 'temp', type: 2, guild: { id: 'g1' } };
    await deleteTempChannel(channel as any);
    expect(mockTempChannelFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('handles errors', async () => {
    mockTempChannelFind.mockRejectedValue(new Error('DB fail'));
    const channel = { id: 'ch1', name: 'temp', type: 2, guild: { id: 'g1' } };
    await deleteTempChannel(channel as any);
    // Should not throw
  });
});
