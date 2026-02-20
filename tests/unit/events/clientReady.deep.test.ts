/**
 * Deep tests for all clientReady event handlers (schedulers).
 * Uses node-cron mock to capture and invoke cron callbacks synchronously.
 */

/* ─── node-cron mock ─── */
let cronCallbacks: Function[] = [];
jest.mock('node-cron', () => ({
  schedule: jest.fn((_expr: string, cb: Function) => {
    cronCallbacks.push(cb);
    return { stop: jest.fn() };
  }),
  __esModule: true,
  default: {
    schedule: jest.fn((_expr: string, cb: Function) => {
      cronCallbacks.push(cb);
      return { stop: jest.fn() };
    }),
  },
}));

/* ─── Common mocks ─── */
jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

jest.mock('../../../src/config/constants/cron', () => ({
  CRON: {
    BIRTHDAY_CHECK: '0 8 * * *',
    CHANNEL_STATS_UPDATE: '*/5 * * * *',
    GIVEAWAY_CHECK: '*/1 * * * *',
    MONTHLY_STATS_GENERATE: '0 0 1 * *',
    MONTHLY_STATS_FLUSH: '*/5 * * * *',
    QUESTION_POST: '0 12 * * *',
    TOURNAMENT_RULES_DEFAULT: '0 18 * * 5',
    TWITCH_STREAM_CHECK: '*/2 * * * *',
    TWITCH_THUMBNAIL_CLEANUP: '0 4 * * *',
    VC_MINUTE_TICK: '*/1 * * * *',
    WARN_MAINTENANCE: '0 3 * * *',
    XP_FLUSH: '*/5 * * * *',
  },
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: 0, ERROR: 0xff0000, GIVEAWAY: 0xff00ff, STREAM: 0x9146ff, MONTHLY_STATS: 0x00aaff },
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      monthlyStats: { crown: '👑', up: '📈', down: '📉', same: '➡️', new: '🆕', mic: '🎤' },
    },
  }),
}));

jest.mock('../../../src/config/guild', () => ({
  getGuildConfig: jest.fn().mockReturnValue({
    roles: { tournamentParticipants: 'r1', tournamentOrganizer: 'r2' },
    channels: { tournamentVoice: 'vc1' },
    tournament: { organizerUserIds: ['u1'] },
  }),
}));

jest.mock('../../../src/config', () => ({
  env: jest.fn().mockReturnValue({ TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret' }),
}));

/* ─── Service mocks ─── */
const mockGetBirthdayConfigs = jest.fn();
const mockGetTodayBirthdays = jest.fn();
jest.mock('../../../src/services/birthdayService', () => ({
  getBirthdayConfigs: mockGetBirthdayConfigs,
  getTodayBirthdays: mockGetTodayBirthdays,
}));

const mockUpdateChannelStats = jest.fn();
jest.mock('../../../src/utils/channelHelpers', () => ({
  updateChannelStats: mockUpdateChannelStats,
}));

const mockFinalizeExpiredGiveaways = jest.fn();
jest.mock('../../../src/services/giveawayService', () => ({
  finalizeExpiredGiveaways: mockFinalizeExpiredGiveaways,
  joinGiveaway: jest.fn(),
  leaveGiveaway: jest.fn(),
  getActiveGiveaway: jest.fn(),
  getGiveaway: jest.fn(),
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
}));

const mockGetConfigMonthly = jest.fn();
const mockGenerateLeaderboard = jest.fn();
const mockGetUserRank = jest.fn();
const mockIsNewUser = jest.fn();
const mockGetTrendEmoji = jest.fn();
const mockFormatVoiceTime = jest.fn();
const mockGetMonthString = jest.fn();
jest.mock('../../../src/services/monthlyStatsService', () => ({
  getConfig: mockGetConfigMonthly,
  generateLeaderboard: mockGenerateLeaderboard,
  getUserRank: mockGetUserRank,
  isNewUser: mockIsNewUser,
  getTrendEmoji: mockGetTrendEmoji,
  formatVoiceTime: mockFormatVoiceTime,
  getMonthString: mockGetMonthString,
  MONTH_NAMES: { '01': 'STYCZEŃ', '02': 'LUTY', '12': 'GRUDZIEŃ' },
}));

const mockFlushMonthlyStats = jest.fn();
jest.mock('../../../src/cache/monthlyStatsCache', () => ({
  flushMonthlyStats: mockFlushMonthlyStats,
  __esModule: true,
  default: { addVoiceMinutes: jest.fn().mockResolvedValue(undefined) },
}));

const mockGetRandomQuestion = jest.fn();
const mockMarkUsed = jest.fn();
jest.mock('../../../src/services/questionService', () => ({
  getRandomQuestion: mockGetRandomQuestion,
  markUsed: mockMarkUsed,
}));

jest.mock('../../../src/models/QuestionConfiguration', () => ({
  QuestionConfigurationModel: { find: jest.fn() },
}));

jest.mock('../../../src/models/TournamentConfig', () => ({
  TournamentConfigModel: { findOne: jest.fn() },
}));

const mockGetActiveStreamers = jest.fn();
const mockSetLiveStatus = jest.fn();
jest.mock('../../../src/services/twitchService', () => ({
  getActiveStreamers: mockGetActiveStreamers,
  setLiveStatus: mockSetLiveStatus,
}));

jest.mock('../../../src/models/StreamConfiguration', () => ({
  StreamConfigurationModel: { find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) },
}));

jest.mock('@twurple/auth', () => ({
  AppTokenAuthProvider: jest.fn(),
}));

const mockGetUserByName = jest.fn();
const mockGetStreamByUserId = jest.fn();
jest.mock('@twurple/api', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    users: { getUserByName: mockGetUserByName },
    streams: { getStreamByUserId: mockGetStreamByUserId },
  })),
}));

jest.mock('undici', () => ({
  fetch: jest.fn().mockResolvedValue({ ok: true, arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('img')) }),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue([]),
      stat: jest.fn().mockResolvedValue({ mtimeMs: Date.now() }),
      unlink: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
    readdirSync: jest.fn().mockReturnValue([]),
    statSync: jest.fn().mockReturnValue({ isDirectory: () => false }),
  };
});

const mockCleanExpiredWarns = jest.fn();
jest.mock('../../../src/services/warnService', () => ({
  cleanExpiredWarns: mockCleanExpiredWarns,
}));

const mockXpFlush = jest.fn();
const mockGetXpConfig = jest.fn();
jest.mock('../../../src/services/xpService', () => ({
  flush: mockXpFlush,
  getConfig: mockGetXpConfig,
}));

const mockXpCacheAddVcMin = jest.fn();
jest.mock('../../../src/cache/xpCache', () => ({
  __esModule: true,
  default: { addVcMin: mockXpCacheAddVcMin },
}));

jest.mock('../../../src/utils/xpMultiplier', () => ({
  getXpMultipliers: jest.fn().mockReturnValue({ role: 1, channel: 1 }),
}));

/* ─── Imports ─── */
import birthdayScheduler from '../../../src/events/clientReady/birthdayScheduler';
import channelStatsScheduler from '../../../src/events/clientReady/channelStatsScheduler';
import giveawayScheduler from '../../../src/events/clientReady/giveawayScheduler';
import monthlyStats from '../../../src/events/clientReady/monthlyStats';
import { startMonthlyStatsFlushScheduler } from '../../../src/events/clientReady/monthlyStatsFlush';
import questionScheduler from '../../../src/events/clientReady/questionScheduler';
import sendTournamentRules from '../../../src/events/clientReady/sendTournamentRules';
import vcMinuteTick from '../../../src/events/clientReady/vcMinuteTick';
import warnSystemMaintenance from '../../../src/events/clientReady/warnSystemMaintenance';
import statusHandler from '../../../src/events/clientReady/status';
import flushXp, { startXpFlushScheduler } from '../../../src/events/clientReady/xpFlush';
import monthlyStatsFlushDefault from '../../../src/events/clientReady/monthlyStatsFlush';
import { QuestionConfigurationModel } from '../../../src/models/QuestionConfiguration';
import { TournamentConfigModel } from '../../../src/models/TournamentConfig';

beforeEach(() => {
  jest.clearAllMocks();
  cronCallbacks = [];
});

function makeClient(guilds: any[] = []) {
  const guildsMap = new Map(guilds.map(g => [g.id, g]));
  return {
    guilds: { cache: guildsMap },
    channels: { cache: new Map() },
    user: { id: 'bot1', setPresence: jest.fn().mockResolvedValue(undefined) },
  };
}

function makeGuild(overrides: any = {}) {
  const channelsMap = new Map(Object.entries(overrides.channels || {}));
  const membersMap = new Map(Object.entries(overrides.members || {}));
  const { channels, members, id, ...rest } = overrides;
  return {
    id: id || 'g1',
    channels: {
      cache: channelsMap,
    },
    members: {
      fetch: jest.fn().mockImplementation((uid: string) => {
        const m = membersMap.get(uid);
        return m ? Promise.resolve(m) : Promise.reject(new Error('Not found'));
      }),
    },
    roles: { cache: new Map() },
    afkChannelId: 'afk1',
    ...rest,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   birthdayScheduler
   ═══════════════════════════════════════════════════════════════════ */
describe('birthdayScheduler', () => {
  it('registers cron and does nothing with no configs', async () => {
    mockGetBirthdayConfigs.mockResolvedValue({ ok: true, data: [] });
    const client = makeClient();
    await birthdayScheduler(client as any);
    expect(cronCallbacks.length).toBeGreaterThan(0);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('handles config fetch error', async () => {
    mockGetBirthdayConfigs.mockResolvedValue({ ok: false, message: 'DB error' });
    const client = makeClient();
    await birthdayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('sends birthday messages and assigns roles', async () => {
    const sendFn = jest.fn().mockResolvedValue(undefined);
    const addRoleFn = jest.fn().mockResolvedValue(undefined);
    const guild = makeGuild({
      id: 'g1',
      channels: {
        ch1: { id: 'ch1', type: 0, send: sendFn },
      },
      members: {
        u1: { id: 'u1', roles: { add: addRoleFn } },
      },
    });
    const client = makeClient([guild]);

    mockGetBirthdayConfigs.mockResolvedValue({
      ok: true,
      data: [{
        guildId: 'g1',
        birthdayChannelId: 'ch1',
        enabled: true,
        message: 'Happy birthday {user}!',
        roleId: 'bRole1',
      }],
    });
    mockGetTodayBirthdays.mockResolvedValue({
      ok: true,
      data: [{ userId: 'u1' }],
    });

    await birthdayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(sendFn).toHaveBeenCalled();
    expect(addRoleFn).toHaveBeenCalledWith('bRole1');
  });

  it('skips disabled configs', async () => {
    mockGetBirthdayConfigs.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'g1', birthdayChannelId: 'ch1', enabled: false }],
    });
    const client = makeClient([makeGuild({ id: 'g1' })]);
    await birthdayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockGetTodayBirthdays).not.toHaveBeenCalled();
  });

  it('warns when guild not found', async () => {
    mockGetBirthdayConfigs.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'unknown', birthdayChannelId: 'ch1', enabled: true }],
    });
    const client = makeClient();
    await birthdayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('warns when channel not found', async () => {
    mockGetBirthdayConfigs.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'g1', birthdayChannelId: 'missing', enabled: true }],
    });
    const client = makeClient([makeGuild({ id: 'g1' })]);
    await birthdayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('handles send error gracefully', async () => {
    const sendFn = jest.fn().mockRejectedValue(new Error('Send failed'));
    const guild = makeGuild({
      id: 'g1',
      channels: { ch1: { id: 'ch1', type: 0, send: sendFn } },
      members: { u1: { id: 'u1', roles: { add: jest.fn() } } },
    });
    const client = makeClient([guild]);
    mockGetBirthdayConfigs.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'g1', birthdayChannelId: 'ch1', enabled: true, message: '{user}', roleId: null }],
    });
    mockGetTodayBirthdays.mockResolvedValue({ ok: true, data: [{ userId: 'u1' }] });
    await birthdayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('handles member fetch error', async () => {
    const guild = makeGuild({
      id: 'g1',
      channels: { ch1: { id: 'ch1', type: 0, send: jest.fn() } },
    });
    (guild.members.fetch as jest.Mock).mockRejectedValue(new Error('Not found'));
    const client = makeClient([guild]);
    mockGetBirthdayConfigs.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'g1', birthdayChannelId: 'ch1', enabled: true }],
    });
    mockGetTodayBirthdays.mockResolvedValue({ ok: true, data: [{ userId: 'u99' }] });
    await birthdayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   channelStatsScheduler
   ═══════════════════════════════════════════════════════════════════ */
describe('channelStatsScheduler', () => {
  it('registers cron and updates stats for each guild', async () => {
    mockUpdateChannelStats.mockResolvedValue(undefined);
    const client = makeClient([makeGuild({ id: 'g1' }), makeGuild({ id: 'g2' })]);
    await channelStatsScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockUpdateChannelStats).toHaveBeenCalledTimes(2);
  });

  it('handles updateChannelStats error per guild', async () => {
    mockUpdateChannelStats
      .mockRejectedValueOnce(new Error('Stats error'))
      .mockResolvedValueOnce(undefined);
    const client = makeClient([makeGuild({ id: 'g1' }), makeGuild({ id: 'g2' })]);
    await channelStatsScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockUpdateChannelStats).toHaveBeenCalledTimes(2);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   giveawayScheduler
   ═══════════════════════════════════════════════════════════════════ */
describe('giveawayScheduler', () => {
  it('does nothing when no expired giveaways', async () => {
    mockFinalizeExpiredGiveaways.mockResolvedValue({ ok: false });
    const client = makeClient();
    await giveawayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('processes expired giveaways with winners', async () => {
    const editFn = jest.fn().mockResolvedValue(undefined);
    const replyFn = jest.fn().mockResolvedValue(undefined);
    const sendFn = jest.fn().mockResolvedValue(undefined);
    const guild = makeGuild({
      id: 'g1',
      channels: {
        ch1: {
          id: 'ch1',
          messages: { fetch: jest.fn().mockResolvedValue({ edit: editFn, reply: replyFn, id: 'msg1' }) },
          send: sendFn,
        },
      },
    });
    const client = makeClient([guild]);
    mockFinalizeExpiredGiveaways.mockResolvedValue({
      ok: true,
      data: [{
        guildId: 'g1',
        channelId: 'ch1',
        messageId: 'msg1',
        winnerIds: ['u1', 'u2'],
        participants: ['u1', 'u2', 'u3'],
        endTime: new Date(),
      }],
    });
    await giveawayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(editFn).toHaveBeenCalled();
    expect(replyFn).toHaveBeenCalled();
  });

  it('handles no winners', async () => {
    const editFn = jest.fn().mockResolvedValue(undefined);
    const replyFn = jest.fn().mockResolvedValue(undefined);
    const guild = makeGuild({
      id: 'g1',
      channels: {
        ch1: {
          id: 'ch1',
          messages: { fetch: jest.fn().mockResolvedValue({ edit: editFn, reply: replyFn, id: 'msg1' }) },
          send: jest.fn(),
        },
      },
    });
    const client = makeClient([guild]);
    mockFinalizeExpiredGiveaways.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'g1', channelId: 'ch1', messageId: 'msg1', winnerIds: [], participants: [], endTime: new Date() }],
    });
    await giveawayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('handles guild not found', async () => {
    mockFinalizeExpiredGiveaways.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'unknown', channelId: 'ch1', messageId: 'msg1', winnerIds: [], participants: [], endTime: new Date() }],
    });
    const client = makeClient();
    await giveawayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('handles message fetch error', async () => {
    const guild = makeGuild({
      id: 'g1',
      channels: {
        ch1: {
          id: 'ch1',
          messages: { fetch: jest.fn().mockRejectedValue(new Error('Not found')) },
          send: jest.fn(),
        },
      },
    });
    const client = makeClient([guild]);
    mockFinalizeExpiredGiveaways.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'g1', channelId: 'ch1', messageId: 'msg1', winnerIds: ['u1'], participants: ['u1'], endTime: new Date() }],
    });
    await giveawayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });

  it('handles reply failure with fallback to send', async () => {
    const editFn = jest.fn().mockResolvedValue(undefined);
    const replyFn = jest.fn().mockRejectedValue(new Error('Reply failed'));
    const sendFn = jest.fn().mockResolvedValue(undefined);
    const guild = makeGuild({
      id: 'g1',
      channels: {
        ch1: {
          id: 'ch1',
          messages: { fetch: jest.fn().mockResolvedValue({ edit: editFn, reply: replyFn, id: 'msg1' }) },
          send: sendFn,
        },
      },
    });
    const client = makeClient([guild]);
    mockFinalizeExpiredGiveaways.mockResolvedValue({
      ok: true,
      data: [{ guildId: 'g1', channelId: 'ch1', messageId: 'msg1', winnerIds: ['u1'], participants: ['u1'], endTime: new Date() }],
    });
    await giveawayScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(sendFn).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   monthlyStatsFlush
   ═══════════════════════════════════════════════════════════════════ */
describe('monthlyStatsFlush', () => {
  it('registers cron on startMonthlyStatsFlushScheduler', () => {
    startMonthlyStatsFlushScheduler();
    expect(cronCallbacks.length).toBeGreaterThan(0);
  });

  it('default export calls startMonthlyStatsFlushScheduler', () => {
    monthlyStatsFlushDefault();
    expect(cronCallbacks.length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   questionScheduler
   ═══════════════════════════════════════════════════════════════════ */
describe('questionScheduler', () => {
  it('does nothing when no configs', async () => {
    (QuestionConfigurationModel.find as jest.Mock).mockResolvedValue([]);
    const client = makeClient();
    await questionScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockGetRandomQuestion).not.toHaveBeenCalled();
  });

  it('posts question, creates thread, adds reactions', async () => {
    const sendFn = jest.fn().mockResolvedValue({
      id: 'qm1',
      react: jest.fn().mockResolvedValue(undefined),
    });
    const createThreadFn = jest.fn().mockResolvedValue(undefined);
    const client = makeClient();
    (client.channels.cache as Map<string, any>).set('qCh1', {
      id: 'qCh1',
      send: sendFn,
      threads: { create: createThreadFn },
    });

    (QuestionConfigurationModel.find as jest.Mock).mockResolvedValue([
      { questionChannelId: 'qCh1', pingRoleId: 'role1' },
    ]);
    mockGetRandomQuestion.mockResolvedValue({
      ok: true,
      data: { questionId: 'q1', content: 'What is life?', reactions: ['👍', '👎'] },
    });
    mockMarkUsed.mockResolvedValue(undefined);

    await questionScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(sendFn).toHaveBeenCalled();
    expect(createThreadFn).toHaveBeenCalled();
    expect(mockMarkUsed).toHaveBeenCalledWith('q1');
  });

  it('handles no available questions', async () => {
    const sendFn = jest.fn().mockResolvedValue({ id: 'qm1', react: jest.fn() });
    const client = makeClient();
    (client.channels.cache as Map<string, any>).set('qCh1', {
      id: 'qCh1',
      send: sendFn,
      threads: { create: jest.fn() },
    });
    (QuestionConfigurationModel.find as jest.Mock).mockResolvedValue([
      { questionChannelId: 'qCh1' },
    ]);
    mockGetRandomQuestion.mockResolvedValue({ ok: false, message: 'No questions' });
    await questionScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(sendFn).toHaveBeenCalledWith(expect.stringContaining('Brak'));
  });

  it('handles missing channel', async () => {
    const client = makeClient();
    (QuestionConfigurationModel.find as jest.Mock).mockResolvedValue([
      { questionChannelId: 'missing' },
    ]);
    await questionScheduler(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   sendTournamentRules
   ═══════════════════════════════════════════════════════════════════ */
describe('sendTournamentRules', () => {
  it('does nothing when no tournament config', async () => {
    (TournamentConfigModel.findOne as jest.Mock).mockResolvedValue(null);
    const client = makeClient();
    await sendTournamentRules(client as any);
    // No cron scheduled for tournament (beyond outer setup)
  });

  it('does nothing when tournament disabled', async () => {
    (TournamentConfigModel.findOne as jest.Mock).mockResolvedValue({ enabled: false });
    const client = makeClient();
    await sendTournamentRules(client as any);
  });

  it('schedules and sends tournament rules', async () => {
    const sendFn = jest.fn().mockResolvedValue({ react: jest.fn().mockResolvedValue(undefined) });
    const client = makeClient();
    (client.channels.cache as Map<string, any>).set('tCh1', {
      id: 'tCh1',
      type: 0,
      guild: { id: 'g1' },
      send: sendFn,
    });

    (TournamentConfigModel.findOne as jest.Mock)
      .mockResolvedValueOnce({ enabled: true, cronSchedule: '0 18 * * 5', channelId: 'tCh1', reactionEmoji: '🎮' })
      .mockResolvedValueOnce({ enabled: true, messageTemplate: 'Rules: {roleMention} in {voiceChannel}', reactionEmoji: '🎮' });

    await sendTournamentRules(client as any);
    // A cron was scheduled - invoke it
    const lastCb = cronCallbacks[cronCallbacks.length - 1];
    if (lastCb) await lastCb();
    expect(sendFn).toHaveBeenCalled();
  });

  it('handles missing channel in callback', async () => {
    const client = makeClient();
    (TournamentConfigModel.findOne as jest.Mock)
      .mockResolvedValueOnce({ enabled: true, channelId: null, cronSchedule: '0 0 * * *' })
      .mockResolvedValueOnce({ enabled: true, channelId: null, messageTemplate: 'test' });
    await sendTournamentRules(client as any);
    const lastCb = cronCallbacks[cronCallbacks.length - 1];
    if (lastCb) await lastCb();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   vcMinuteTick
   ═══════════════════════════════════════════════════════════════════ */
describe('vcMinuteTick', () => {
  it('adds XP for voice channel members', async () => {
    mockGetXpConfig.mockResolvedValue({ xpPerMinVc: 10, ignoredChannels: [], ignoredRoles: [] });
    const member = {
      id: 'u1',
      user: { bot: false },
      voice: { serverMute: false, serverDeaf: false },
      roles: { cache: { has: jest.fn().mockReturnValue(false) } },
    };
    const voiceChannel = {
      id: 'vc1',
      isVoiceBased: () => true,
      members: new Map([['u1', member]]),
    };
    const guild = {
      id: 'g1',
      afkChannelId: 'afk1',
      channels: { cache: new Map([['vc1', voiceChannel]]) },
    };
    const client = makeClient([guild]);
    vcMinuteTick(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockXpCacheAddVcMin).toHaveBeenCalled();
  });

  it('skips bots and muted members', async () => {
    mockGetXpConfig.mockResolvedValue({ xpPerMinVc: 10, ignoredChannels: [], ignoredRoles: [] });
    const botMember = { id: 'b1', user: { bot: true }, voice: { serverMute: false, serverDeaf: false }, roles: { cache: { has: jest.fn() } } };
    const mutedMember = { id: 'u2', user: { bot: false }, voice: { serverMute: true, serverDeaf: false }, roles: { cache: { has: jest.fn() } } };
    const deafMember = { id: 'u3', user: { bot: false }, voice: { serverMute: false, serverDeaf: true }, roles: { cache: { has: jest.fn() } } };
    const voiceChannel = {
      id: 'vc1',
      isVoiceBased: () => true,
      members: new Map([['b1', botMember], ['u2', mutedMember], ['u3', deafMember]]),
    };
    const guild = {
      id: 'g1',
      afkChannelId: 'afk1',
      channels: { cache: new Map([['vc1', voiceChannel]]) },
    };
    const client = makeClient([guild]);
    vcMinuteTick(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockXpCacheAddVcMin).not.toHaveBeenCalled();
  });

  it('skips AFK channel and ignored channels', async () => {
    mockGetXpConfig.mockResolvedValue({ xpPerMinVc: 10, ignoredChannels: ['vc2'], ignoredRoles: [] });
    const vc1 = { id: 'afk1', isVoiceBased: () => true, members: new Map([['u1', { id: 'u1', user: { bot: false }, voice: { serverMute: false, serverDeaf: false }, roles: { cache: { has: jest.fn() } } }]]) };
    const vc2 = { id: 'vc2', isVoiceBased: () => true, members: new Map([['u2', { id: 'u2', user: { bot: false }, voice: { serverMute: false, serverDeaf: false }, roles: { cache: { has: jest.fn() } } }]]) };
    const guild = {
      id: 'g1',
      afkChannelId: 'afk1',
      channels: { cache: new Map([['afk1', vc1], ['vc2', vc2]]) },
    };
    const client = makeClient([guild]);
    vcMinuteTick(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockXpCacheAddVcMin).not.toHaveBeenCalled();
  });

  it('skips non-voice channels', async () => {
    mockGetXpConfig.mockResolvedValue({ xpPerMinVc: 10, ignoredChannels: [], ignoredRoles: [] });
    const textChannel = { id: 'tc1', isVoiceBased: () => false, members: new Map() };
    const guild = {
      id: 'g1',
      afkChannelId: 'afk1',
      channels: { cache: new Map([['tc1', textChannel]]) },
    };
    const client = makeClient([guild]);
    vcMinuteTick(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockXpCacheAddVcMin).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   warnSystemMaintenance
   ═══════════════════════════════════════════════════════════════════ */
describe('warnSystemMaintenance', () => {
  it('cleans expired warns', async () => {
    process.env.GUILD_ID = 'g1';
    mockCleanExpiredWarns.mockResolvedValue({ ok: true, data: { totalRemoved: 3, usersAffected: 2 } });
    await warnSystemMaintenance();
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockCleanExpiredWarns).toHaveBeenCalledWith({ guildId: 'g1' });
  });

  it('skips when GUILD_ID not set', async () => {
    delete process.env.GUILD_ID;
    await warnSystemMaintenance();
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockCleanExpiredWarns).not.toHaveBeenCalled();
  });

  it('handles clean error', async () => {
    process.env.GUILD_ID = 'g1';
    mockCleanExpiredWarns.mockRejectedValue(new Error('DB error'));
    await warnSystemMaintenance();
    await cronCallbacks[cronCallbacks.length - 1]();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   status
   ═══════════════════════════════════════════════════════════════════ */
describe('status', () => {
  it('sets presence on client', async () => {
    const client = makeClient();
    await statusHandler(client as any);
    expect(client.user.setPresence).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'online' })
    );
  });

  it('returns early when no client.user', async () => {
    const client = { guilds: { cache: new Map() }, user: null };
    await statusHandler(client as any);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   xpFlush
   ═══════════════════════════════════════════════════════════════════ */
describe('xpFlush', () => {
  it('default export calls flush', async () => {
    mockXpFlush.mockResolvedValue(undefined);
    await flushXp();
    expect(mockXpFlush).toHaveBeenCalled();
  });

  it('startXpFlushScheduler registers cron', () => {
    startXpFlushScheduler();
    expect(cronCallbacks.length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   monthlyStats
   ═══════════════════════════════════════════════════════════════════ */
describe('monthlyStats', () => {
  it('generates and sends monthly leaderboard', async () => {
    const sendFn = jest.fn().mockResolvedValue(undefined);
    const guild = {
      id: 'g1',
      client: { user: { id: 'bot1' } },
      channels: { cache: new Map([['msCh1', { id: 'msCh1', send: sendFn }]]) },
    };
    const client = makeClient([guild]);

    mockGetConfigMonthly.mockResolvedValue({
      ok: true,
      data: { enabled: true, channelId: 'msCh1', topCount: 5 },
    });
    mockGetMonthString.mockReturnValue('2024-01');
    mockGenerateLeaderboard.mockResolvedValue({
      ok: true,
      data: {
        topMessages: [{ userId: 'u1', messageCount: 100, rank: 1 }],
        topVoice: [{ userId: 'u1', voiceMinutes: 300, rank: 1 }],
        totalMessages: 500,
      },
    });
    mockGetTrendEmoji.mockReturnValue('📈');
    mockIsNewUser.mockReturnValue(false);
    mockFormatVoiceTime.mockReturnValue('5h');
    mockGetUserRank.mockResolvedValue(1);

    monthlyStats(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(sendFn).toHaveBeenCalled();
  });

  it('skips when config disabled', async () => {
    const guild = {
      id: 'g1',
      client: { user: { id: 'bot1' } },
      channels: { cache: new Map() },
    };
    const client = makeClient([guild]);
    mockGetConfigMonthly.mockResolvedValue({ ok: true, data: { enabled: false } });
    monthlyStats(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockGenerateLeaderboard).not.toHaveBeenCalled();
  });

  it('skips when no channel', async () => {
    const guild = {
      id: 'g1',
      client: { user: { id: 'bot1' } },
      channels: { cache: new Map() },
    };
    const client = makeClient([guild]);
    mockGetConfigMonthly.mockResolvedValue({ ok: true, data: { enabled: true, channelId: 'missing', topCount: 5 } });
    monthlyStats(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(mockGenerateLeaderboard).not.toHaveBeenCalled();
  });

  it('skips when leaderboard empty', async () => {
    const sendFn = jest.fn();
    const guild = {
      id: 'g1',
      client: { user: { id: 'bot1' } },
      channels: { cache: new Map([['msCh1', { id: 'msCh1', send: sendFn }]]) },
    };
    const client = makeClient([guild]);
    mockGetConfigMonthly.mockResolvedValue({ ok: true, data: { enabled: true, channelId: 'msCh1', topCount: 5 } });
    mockGetMonthString.mockReturnValue('2024-01');
    mockGenerateLeaderboard.mockResolvedValue({
      ok: true,
      data: { topMessages: [], topVoice: [], totalMessages: 0 },
    });
    monthlyStats(client as any);
    await cronCallbacks[cronCallbacks.length - 1]();
    expect(sendFn).not.toHaveBeenCalled();
  });
});
