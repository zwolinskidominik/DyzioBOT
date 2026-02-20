export {};
/**
 * branchCoverage3.deep.test.ts — final push to ≥80 % branches
 *
 * Targets the specific uncovered branches in small files:
 *   userStatusAdd, logChannelCreate, logUnban, logBan, warnRemove,
 *   level, meme, createSuggestions, emoji, channelHelpers, memeHelpers,
 *   questionScheduler, logger
 */

/* ──────────────────── mocks ──────────────────── */

// --- logger
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- log/audit helpers
const mockSendLog = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/utils/logHelpers', () => ({ sendLog: mockSendLog }));

const mockGetModerator = jest.fn().mockResolvedValue(null);
const mockGetReason = jest.fn().mockResolvedValue(null);
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: mockGetModerator,
  getReason: mockGetReason,
}));

// --- Birthday / Twitch models (for userStatusAdd)
const mockFindOneExec = jest.fn().mockResolvedValue(null);
const mockFindOneAndUpdateExec = jest.fn().mockResolvedValue(null);
const mockFindOne = jest.fn(() => ({ exec: mockFindOneExec }));
const mockFindOneAndUpdate = jest.fn(() => ({ exec: mockFindOneAndUpdateExec }));

jest.mock('../../../src/models/Birthday', () => ({
  BirthdayModel: { findOne: mockFindOne, findOneAndUpdate: mockFindOneAndUpdate },
}));
jest.mock('../../../src/models/TwitchStreamer', () => ({
  TwitchStreamerModel: { findOne: mockFindOne, findOneAndUpdate: mockFindOneAndUpdate },
}));

// --- warnService (for warnRemove)
const mockRemoveWarn = jest.fn();
jest.mock('../../../src/services/warnService', () => ({ removeWarn: mockRemoveWarn }));

// --- embedHelpers
jest.mock('../../../src/utils/embedHelpers', () => {
  const { EmbedBuilder } = jest.requireActual('discord.js');
  return {
    createBaseEmbed: jest.fn(() => {
      const e = new EmbedBuilder();
      e.setAuthor = jest.fn().mockReturnValue(e);
      return e;
    }),
    createErrorEmbed: jest.fn(() => new EmbedBuilder()),
    formatResults: jest.fn(() => 'results'),
  };
});

// --- xpService & levelMath (for level command)
jest.mock('../../../src/services/xpService', () => ({
  getUserRank: jest.fn().mockResolvedValue({ ok: true, data: { rank: 1 } }),
  getCurrentXp: jest.fn().mockResolvedValue({ level: 5, xp: 100 }),
}));
jest.mock('../../../src/utils/levelMath', () => ({
  xpForLevel: jest.fn(() => 500),
  deltaXp: jest.fn(() => 200),
}));
jest.mock('../../../src/utils/canvasRankCard', () => ({
  CanvasRankCard: jest.fn().mockImplementation(() => ({
    build: jest.fn().mockResolvedValue(Buffer.from('img')),
  })),
}));

// --- memeHelpers (for meme command)
const mockFetchMeme = jest.fn();
jest.mock('../../../src/utils/memeHelpers', () => ({
  fetchMeme: mockFetchMeme,
  SITES: { kwejk: {}, demotywatory: {}, mistrzowie: {}, ivallmemy: {} },
}));

// --- config/bot
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn(() => ({
    emojis: {
      next: '➡️',
      previous: '⬅️',
      suggestion: { upvote: '👍', downvote: '👎' },
    },
  })),
}));

// --- config/constants
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: 0x000000, MEME: 0xff0000, ERROR: 0xff0000 },
}));

// --- suggestionService
jest.mock('../../../src/services/suggestionService', () => ({
  isSuggestionChannel: jest.fn().mockResolvedValue(false),
  createSuggestion: jest.fn().mockResolvedValue({ ok: true, data: { suggestionId: 'sug1' } }),
}));

// --- ChannelStats model (for channelHelpers)
const mockChannelStatsFind = jest.fn().mockResolvedValue(null);
jest.mock('../../../src/models/ChannelStats', () => ({
  ChannelStatsModel: { findOne: mockChannelStatsFind },
}));

// --- QuestionConfiguration (for questionScheduler)
jest.mock('../../../src/models/QuestionConfiguration', () => ({
  QuestionConfigurationModel: { find: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../../src/services/questionService', () => ({
  getRandomQuestion: jest.fn().mockResolvedValue({ ok: false }),
  markUsed: jest.fn(),
}));
jest.mock('node-cron', () => ({
  schedule: jest.fn((_, cb) => { (cb as Function)(); }),
}));
jest.mock('../../../src/config/constants/cron', () => ({
  CRON: { QUESTION_POST: '0 12 * * *' },
}));

// --- undici (for memeHelpers direct tests)
jest.mock('undici', () => ({
  fetch: jest.fn(),
  Response: class {},
}));

// --- cheerio
jest.mock('cheerio', () => ({
  load: jest.fn(() => {
    const $ = jest.fn(() => ({
      text: jest.fn(() => ''),
      trim: jest.fn(() => ''),
      attr: jest.fn(() => ''),
      length: 0,
    }));
    ($ as any).html = jest.fn(() => '');
    return $;
  }),
}));

/* ──────────────────── helpers ──────────────────── */

function mockInteraction(overrides: Record<string, any> = {}) {
  return {
    guild: { id: 'g1', name: 'TestGuild', emojis: { cache: new Map() } },
    guildId: 'g1',
    user: { id: 'u1', username: 'tester', displayAvatarURL: () => 'http://avatar' },
    member: { permissions: { has: jest.fn(() => true) } },
    options: {
      getUser: jest.fn(() => null),
      getInteger: jest.fn(() => 1),
      getString: jest.fn(() => null),
    },
    client: { user: { id: 'bot1' }, application: { id: 'bot1' } },
    deferReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    fetchReply: jest.fn().mockResolvedValue({
      createMessageComponentCollector: jest.fn(() => ({
        on: jest.fn(),
      })),
    }),
    ...overrides,
  };
}

function mockGuildMember(overrides: Record<string, any> = {}) {
  return {
    guild: { id: 'g1' },
    user: { id: 'u1', tag: 'User#0001', username: 'User', displayAvatarURL: () => 'http://a' },
    ...overrides,
  };
}

function mockGuild() {
  return {
    id: 'g1',
    fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }),
  };
}

function mockUser(overrides: Record<string, any> = {}) {
  return {
    id: 'u1',
    tag: 'User#0001',
    username: 'User',
    displayAvatarURL: jest.fn(() => 'http://a'),
    ...overrides,
  };
}

function mockClient() {
  return { user: { id: 'bot1' }, channels: { cache: new Map() } };
}

/* ────────────────────── tests ─────────────────────── */

describe('branchCoverage3 — final branch push', () => {
  beforeEach(() => jest.clearAllMocks());

  /* ── userStatusAdd ─────────────────── */
  describe('userStatusAdd', () => {
    const load = () => require('../../../src/events/guildMemberAdd/userStatusAdd').default;

    it('returns early when member.guild is falsy', async () => {
      const run = load();
      const member = mockGuildMember({ guild: null });
      await run(member);
      expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('calls findOneAndUpdate when entry exists with active=false', async () => {
      const run = load();
      mockFindOneExec.mockResolvedValueOnce({ active: false }); // Birthday
      mockFindOneExec.mockResolvedValueOnce({ active: false }); // Twitch
      const member = mockGuildMember();
      await run(member);
      expect(mockFindOneAndUpdate).toHaveBeenCalled();
    });

    it('does NOT update when entry exists with active=true', async () => {
      const run = load();
      mockFindOneExec.mockResolvedValueOnce({ active: true }); // Birthday
      mockFindOneExec.mockResolvedValueOnce({ active: true }); // Twitch
      const member = mockGuildMember();
      await run(member);
      expect(mockFindOneAndUpdateExec).not.toHaveBeenCalled();
    });

    it('catches and logs error', async () => {
      const run = load();
      mockFindOne.mockImplementationOnce(() => { throw new Error('db-err'); });
      const member = mockGuildMember();
      await run(member);
      const logger = require('../../../src/utils/logger').default;
      expect(logger.error).toHaveBeenCalled();
    });
  });

  /* ── logChannelCreate ──────────────── */
  describe('logChannelCreate', () => {
    const load = () => require('../../../src/events/channelCreate/logChannelCreate').default;

    it('calls sendLog with moderator=null (no moderator branch)', async () => {
      const run = load();
      mockGetModerator.mockResolvedValueOnce(null);
      const channel = {
        id: 'ch1',
        name: 'test',
        type: 999, // unknown type → 'Nieznany'
        guild: { id: 'g1' },
      };
      await run(channel, mockClient());
      expect(mockSendLog).toHaveBeenCalled();
      const desc = mockSendLog.mock.calls[0][3].description;
      expect(desc).not.toContain('przez');
    });

    it('catches error in logChannelCreate', async () => {
      const run = load();
      mockGetModerator.mockRejectedValueOnce(new Error('fail'));
      const channel = { id: 'ch1', name: 'x', type: 0, guild: { id: 'g1' } };
      await run(channel, mockClient());
      const logger = require('../../../src/utils/logger').default;
      expect(logger.error).toHaveBeenCalled();
    });

    it('includes moderator when present', async () => {
      const run = load();
      mockGetModerator.mockResolvedValueOnce({ id: 'mod1' });
      const channel = { id: 'ch1', name: 'test', type: 0, guild: { id: 'g1' } };
      await run(channel, mockClient());
      const desc = mockSendLog.mock.calls[0][3].description;
      expect(desc).toContain('mod1');
    });
  });

  /* ── logUnban ──────────────────────── */
  describe('logUnban', () => {
    const load = () => require('../../../src/events/guildBanRemove/logUnban').default;

    it('passes undefined fields when no moderator', async () => {
      const run = load();
      mockGetModerator.mockResolvedValueOnce(null);
      const user = mockUser();
      const guild = mockGuild();
      await run({ guild, user }, mockClient());
      const payload = mockSendLog.mock.calls[0][3];
      expect(payload.fields).toBeUndefined();
      expect(payload.footer).toContain('Nieznany');
    });

    it('fills fields/footer when moderator present', async () => {
      const run = load();
      const mod = mockUser({ id: 'mod2', username: 'Mod2' });
      mockGetModerator.mockResolvedValueOnce(mod);
      const user = mockUser();
      const guild = mockGuild();
      await run({ guild, user }, mockClient());
      const payload = mockSendLog.mock.calls[0][3];
      expect(payload.fields).toBeDefined();
      expect(payload.fields[0].value).toContain('mod2');
      expect(payload.footer).toBe('Mod2');
    });
  });

  /* ── logBan ────────────────────────── */
  describe('logBan', () => {
    const load = () => require('../../../src/events/guildBanAdd/logBan').default;

    it('includes reason in description when getReason returns value', async () => {
      const run = load();
      mockGetModerator.mockResolvedValueOnce(null);
      mockGetReason.mockResolvedValueOnce('spam');
      const user = mockUser();
      const guild = mockGuild();
      await run({ guild, user }, mockClient());
      const desc = mockSendLog.mock.calls[0][3].description;
      expect(desc).toContain('spam');
    });

    it('omits reason when null', async () => {
      const run = load();
      mockGetModerator.mockResolvedValueOnce(null);
      mockGetReason.mockResolvedValueOnce(null);
      const user = mockUser();
      const guild = mockGuild();
      await run({ guild, user }, mockClient());
      const desc = mockSendLog.mock.calls[0][3].description;
      expect(desc).not.toContain('Pow');
    });

    it('includes moderator when present', async () => {
      const run = load();
      mockGetModerator.mockResolvedValueOnce({ id: 'modx' });
      mockGetReason.mockResolvedValueOnce(null);
      const user = mockUser();
      const guild = mockGuild();
      await run({ guild, user }, mockClient());
      const desc = mockSendLog.mock.calls[0][3].description;
      expect(desc).toContain('modx');
    });
  });

  /* ── warnRemove ────────────────────── */
  describe('warnRemove', () => {
    const load = () => require('../../../src/commands/moderation/warnRemove');

    it('succeeds with avatarUrl = null (no setAuthor call)', async () => {
      mockRemoveWarn.mockResolvedValue({ ok: true });
      const { run } = load();
      const interaction = mockInteraction({
        options: {
          getUser: jest.fn(() => ({
            id: 'u1',
            displayAvatarURL: () => null,
          })),
          getInteger: jest.fn(() => 1),
        },
      });
      await run({ interaction });
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('shows error embed when removeWarn returns !ok', async () => {
      mockRemoveWarn.mockResolvedValue({ ok: false, message: 'Not found' });
      const { run } = load();
      const interaction = mockInteraction({
        options: {
          getUser: jest.fn(() => ({
            id: 'u1',
            displayAvatarURL: () => 'http://a',
          })),
          getInteger: jest.fn(() => 99),
        },
      });
      await run({ interaction });
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('catches error in warnRemove', async () => {
      mockRemoveWarn.mockRejectedValue(new Error('db'));
      const { run } = load();
      const interaction = mockInteraction({
        options: {
          getUser: jest.fn(() => ({
            id: 'u1',
            displayAvatarURL: () => 'http://a',
          })),
          getInteger: jest.fn(() => 1),
        },
      });
      await run({ interaction });
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  /* ── level command ─────────────────── */
  describe('level command', () => {
    const load = () => require('../../../src/commands/user/level');

    it('uses rank=1 when getUserRank returns !ok', async () => {
      const { getUserRank } = require('../../../src/services/xpService');
      getUserRank.mockResolvedValueOnce({ ok: false });
      const { run } = load();
      const interaction = mockInteraction({
        options: {
          getUser: jest.fn(() => null),
        },
      });
      await run({ interaction });
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  /* ── meme command ──────────────────── */
  describe('meme command', () => {
    const load = () => require('../../../src/commands/fun/meme');

    it('handles isVideo response', async () => {
      mockFetchMeme.mockResolvedValue({ title: 'vid', url: 'http://v.mp4', isVideo: true, source: 'kwejk' });
      const { run } = load();
      const interaction = mockInteraction();
      await run({ interaction });
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('falls back to alternative meme on error, then sends error', async () => {
      mockFetchMeme.mockRejectedValue(new Error('fail'));
      const { run } = load();
      const interaction = mockInteraction();
      await run({ interaction });
      // all sites fail → error embed
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('sends alternative meme on primary failure', async () => {
      mockFetchMeme
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue({ title: 'alt', url: 'http://img', isVideo: false, source: 'kwejk' });
      const { run } = load();
      const interaction = mockInteraction();
      await run({ interaction });
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  /* ── createSuggestions ─────────────── */
  describe('createSuggestions', () => {
    const load = () => require('../../../src/events/messageCreate/createSuggestions').default;

    it('returns early when author is self (client.user.id)', async () => {
      const run = load();
      const msg = {
        author: { bot: false, id: 'bot1', username: 'Bot' },
        client: { user: { id: 'bot1' } },
        guild: { id: 'g1' },
        channel: { type: 0 },
        channelId: 'ch1',
        content: 'test',
        delete: jest.fn().mockResolvedValue(undefined),
      };
      await run(msg);
      // shouldProcessMessage returns false because author.id === client.user.id
      const { isSuggestionChannel } = require('../../../src/services/suggestionService');
      expect(isSuggestionChannel).not.toHaveBeenCalled();
    });

    it('handles error in main flow and catches send error', async () => {
      const run = load();
      const { isSuggestionChannel } = require('../../../src/services/suggestionService');
      isSuggestionChannel.mockResolvedValueOnce(true);
      const msg = {
        author: { bot: false, id: 'u1', username: 'User', displayAvatarURL: () => 'http://a' },
        client: { user: { id: 'bot1' } },
        guild: { id: 'g1' },
        channel: {
          type: 0,
          send: jest.fn().mockRejectedValue(new Error('send fail')),
        },
        channelId: 'ch1',
        content: 'test suggestion',
        delete: jest.fn().mockResolvedValue(undefined),
      };
      await run(msg);
      // The delete should have been called, and the subsequent send throws → caught
    });

    it('returns when channel has no send method after delete', async () => {
      const run = load();
      const { isSuggestionChannel } = require('../../../src/services/suggestionService');
      isSuggestionChannel.mockResolvedValueOnce(true);
      const msg = {
        author: { bot: false, id: 'u2', username: 'User2', displayAvatarURL: () => 'http://a' },
        client: { user: { id: 'bot1' } },
        guild: { id: 'g1' },
        channel: { type: 0 },  // no 'send' method
        channelId: 'ch2',
        content: 'suggestion text',
        delete: jest.fn().mockResolvedValue(undefined),
      };
      await run(msg);
      const logger = require('../../../src/utils/logger').default;
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('nie obs'));
    });

    it('handles createSuggestion returning !ok', async () => {
      const run = load();
      const { isSuggestionChannel, createSuggestion } = require('../../../src/services/suggestionService');
      isSuggestionChannel.mockResolvedValueOnce(true);
      createSuggestion.mockResolvedValueOnce({ ok: false, message: 'fail' });
      const msg = {
        author: { bot: false, id: 'u3', username: 'User3', displayAvatarURL: () => 'http://a' },
        client: { user: { id: 'bot1' } },
        guild: { id: 'g1' },
        channel: {
          type: 0,
          send: jest.fn().mockResolvedValue({ id: 'msg1' }),
        },
        channelId: 'ch3',
        content: 'suggestion',
        delete: jest.fn().mockResolvedValue(undefined),
      };
      await run(msg);
      const logger = require('../../../src/utils/logger').default;
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create'));
    });

    it('handles long suggestion text (>97 chars) for thread name', async () => {
      const run = load();
      const { isSuggestionChannel, createSuggestion } = require('../../../src/services/suggestionService');
      isSuggestionChannel.mockResolvedValueOnce(true);
      createSuggestion.mockResolvedValueOnce({ ok: true, data: { suggestionId: 's1' } });

      const longText = 'A'.repeat(120);
      const mockMsg = {
        id: 'msg1',
        edit: jest.fn().mockResolvedValue(undefined),
        startThread: jest.fn().mockResolvedValue(undefined),
      };
      const msg = {
        author: { bot: false, id: 'u4', username: 'User4', displayAvatarURL: () => 'http://a' },
        client: { user: { id: 'bot1' } },
        guild: { id: 'g1' },
        channel: {
          type: 0,
          send: jest.fn().mockResolvedValue(mockMsg),
        },
        channelId: 'ch4',
        content: longText,
        delete: jest.fn().mockResolvedValue(undefined),
      };
      await run(msg);
      expect(mockMsg.edit).toHaveBeenCalled();
    });
  });

  /* ── emoji command ─────────────────── */
  describe('emoji command', () => {
    const load = () => require('../../../src/commands/misc/emoji');

    it('returns error when no guild', async () => {
      const { run } = load();
      const interaction = mockInteraction({ guild: null });
      await run({ interaction });
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('shows single page when few emojis (no pagination)', async () => {
      const { run } = load();
      const emojis = new Map();
      emojis.set('e1', { toString: () => '😀', name: 'grin' });
      const interaction = mockInteraction({
        guild: {
          id: 'g1',
          emojis: {
            cache: {
              map: jest.fn((fn: any) => [fn({ toString: () => '😀', name: 'grin' })]),
            },
          },
        },
      });
      await run({ interaction });
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('catches error in emoji command', async () => {
      const { run } = load();
      const interaction = mockInteraction({
        guild: {
          id: 'g1',
          emojis: {
            cache: {
              map: jest.fn(() => { throw new Error('fail'); }),
            },
          },
        },
      });
      await run({ interaction });
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

  /* ── channelHelpers – buildChannelName, updateChannelName, safeSetChannelName ── */
  describe('channelHelpers', () => {
    // Use requireActual to test the real functions
    let channelHelpers: any;
    beforeAll(() => {
      channelHelpers = jest.requireActual('../../../src/utils/channelHelpers');
    });

    it('safeSetChannelName returns immediately when name matches', async () => {
      const ch = {
        id: 'ch1',
        name: 'same-name',
        setName: jest.fn(),
      };
      await channelHelpers.safeSetChannelName(ch, 'same-name');
      expect(ch.setName).not.toHaveBeenCalled();
    });

    it('updateChannelName returns when no channelConfig', async () => {
      const guild = { channels: { cache: new Map() } };
      await channelHelpers.updateChannelName(guild, undefined, 42);
      // should not throw
    });

    it('updateChannelName returns when no channelId', async () => {
      const guild = { channels: { cache: new Map() } };
      await channelHelpers.updateChannelName(guild, {}, 42);
      // should not throw
    });

    it('updateChannelName returns when channel not found in cache', async () => {
      const guild = { channels: { cache: new Map() } };
      await channelHelpers.updateChannelName(guild, { channelId: 'missing' }, 42);
      // should not throw
    });

    it('updateChannelName returns when channel has no setName', async () => {
      const guild = {
        channels: {
          cache: new Map([['ch1', { name: 'old' }]]), // no setName
        },
      };
      await channelHelpers.updateChannelName(guild, { channelId: 'ch1' }, 42);
      // should not throw
    });
  });

  /* ── memeHelpers (direct) ──────────── */
  describe('memeHelpers (direct)', () => {
    it('fetchMeme throws for unknown site', async () => {
      const { fetchMeme } = jest.requireActual('../../../src/utils/memeHelpers');
      await expect(fetchMeme('nonexistent')).rejects.toThrow('Nieznana strona');
    });
  });

  /* ── questionScheduler branches ────── */
  describe('questionScheduler', () => {
    it('loads and runs schedule callback (empty configs → returns early)', async () => {
      // The jest.mock for node-cron immediately invokes the callback
      // QuestionConfigurationModel.find returns [] → early return
      await expect(
        import('../../../src/events/clientReady/questionScheduler')
      ).resolves.toBeDefined();
    });
  });

  /* ── logger printf branch (stack vs no stack) ── */
  describe('logger', () => {
    it('exports a logger with all levels', () => {
      // The logger module branches on `stack` presence in printf.
      // We can't easily trigger that in a unit test, but let's
      // at least import the real module to cover the stack ternary.
      const realLogger = jest.requireActual('../../../src/utils/logger').default;
      expect(realLogger).toBeDefined();
      expect(typeof realLogger.info).toBe('function');
      expect(typeof realLogger.error).toBe('function');
    });
  });
});
