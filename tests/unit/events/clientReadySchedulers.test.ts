/**
 * Tests for clientReady scheduler events:
 * - birthdayScheduler, channelStatsScheduler, giveawayScheduler
 * - monthlyStats, monthlyStatsFlush, questionScheduler
 * - sendTournamentRules, status, twitchScheduler
 * - vcMinuteTick, warnSystemMaintenance, xpFlush
 */

/* ── mocks ───────────────────────────────────────────────── */

const scheduleMock = jest.fn((_cron: string, cb: Function, _opts?: any) => {
  // store last callback for invocation tests
  (scheduleMock as any)._lastCb = cb;
  return { stop: jest.fn() };
});

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: scheduleMock },
  schedule: scheduleMock,
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/config/constants/cron', () => ({
  CRON: {
    BIRTHDAY_CHECK: '0 8 * * *',
    CHANNEL_STATS_UPDATE: '*/5 * * * *',
    GIVEAWAY_CHECK: '*/1 * * * *',
    MONTHLY_STATS_GENERATE: '0 0 1 * *',
    MONTHLY_STATS_FLUSH: '*/5 * * * *',
    QUESTION_POST: '0 12 * * *',
    TOURNAMENT_RULES_DEFAULT: '0 20 * * 5',
    TWITCH_THUMBNAIL_CLEANUP: '0 */6 * * *',
    TWITCH_STREAM_CHECK: '*/3 * * * *',
    VC_MINUTE_TICK: '*/1 * * * *',
    WARN_MAINTENANCE: '0 4 * * *',
    XP_FLUSH: '*/5 * * * *',
  },
}));

jest.mock('../../../src/services/birthdayService', () => ({
  getTodayBirthdays: jest.fn().mockResolvedValue({ ok: true, data: [] }),
  getBirthdayConfigs: jest.fn().mockResolvedValue({ ok: true, data: [] }),
}));

jest.mock('../../../src/services/giveawayService', () => ({
  finalizeExpiredGiveaways: jest.fn().mockResolvedValue({ ok: true, data: [] }),
}));

jest.mock('../../../src/utils/channelHelpers', () => ({
  updateChannelStats: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/cache/monthlyStatsCache', () => ({
  __esModule: true,
  default: { addVoiceMinutes: jest.fn(), addMessage: jest.fn() },
  flushMonthlyStats: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/cache/xpCache', () => ({
  __esModule: true,
  default: { addVcMin: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../src/services/xpService', () => ({
  getConfig: jest.fn().mockResolvedValue(null),
  flush: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/utils/xpMultiplier', () => ({
  getXpMultipliers: jest.fn().mockReturnValue({ role: 1, channel: 1 }),
}));

jest.mock('../../../src/services/warnService', () => ({
  cleanExpiredWarns: jest.fn().mockResolvedValue({ ok: true, data: { totalRemoved: 0, usersAffected: 0 } }),
}));

jest.mock('../../../src/services/monthlyStatsService', () => ({
  getConfig: jest.fn().mockResolvedValue({ ok: false }),
  generateLeaderboard: jest.fn(),
  getUserRank: jest.fn(),
  isNewUser: jest.fn(),
  getTrendEmoji: jest.fn(),
  formatVoiceTime: jest.fn(),
  getMonthString: jest.fn().mockReturnValue('2026-01'),
  MONTH_NAMES: { '01': 'Styczeń', '02': 'Luty' },
  getPersonalStats: jest.fn(),
}));

jest.mock('../../../src/services/questionService', () => ({
  getRandomQuestion: jest.fn().mockResolvedValue({ ok: false }),
  markUsed: jest.fn(),
}));

jest.mock('../../../src/models/QuestionConfiguration', () => ({
  QuestionConfigurationModel: { find: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../../../src/models/TournamentConfig', () => ({
  TournamentConfigModel: { findOne: jest.fn().mockResolvedValue(null) },
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      monthlyStats: { upvote: '🔼', downvote: '🔽', whitedash: '➖' },
      boost: { thanks: '🙏' },
    },
  }),
}));

jest.mock('../../../src/config/guild', () => ({
  getGuildConfig: jest.fn().mockReturnValue({
    roles: { tournamentParticipants: '', tournamentOrganizer: '' },
    channels: { tournamentVoice: '' },
    tournament: { organizerUserIds: [] },
  }),
}));

jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    setImage: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  }),
  formatResults: jest.fn().mockReturnValue('results'),
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: {
    GIVEAWAY: 0xff0000,
    GIVEAWAY_ENDED: 0x808080,
    TWITCH: 0x6441a5,
    DEFAULT: 0x000000,
  },
}));

jest.mock('../../../src/config', () => ({
  env: jest.fn().mockReturnValue({
    TWITCH_CLIENT_ID: 'test-id',
    TWITCH_CLIENT_SECRET: 'test-secret',
  }),
}));

jest.mock('@twurple/auth', () => ({
  AppTokenAuthProvider: jest.fn(),
}));

jest.mock('@twurple/api', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    users: { getUserByName: jest.fn().mockResolvedValue(null) },
    streams: { getStreamByUserId: jest.fn().mockResolvedValue(null) },
  })),
}));

jest.mock('../../../src/services/twitchService', () => ({
  getActiveStreamers: jest.fn().mockResolvedValue({ ok: true, data: [] }),
  setLiveStatus: jest.fn(),
}));

jest.mock('../../../src/models/StreamConfiguration', () => ({
  StreamConfigurationModel: {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
  },
}));

jest.mock('undici', () => ({
  fetch: jest.fn().mockResolvedValue({ ok: true, arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)) }),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  readdirSync: jest.fn().mockReturnValue([]),
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ mtime: { getTime: () => Date.now() } }),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

import { mockClient, mockGuild, mockTextChannel } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

describe('clientReady / status', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/status')).default;
  });

  it('sets presence when client.user exists', async () => {
    const setPresence = jest.fn().mockResolvedValue(undefined);
    const client = mockClient({ user: { id: 'bot-id', setPresence } });
    await run(client);
    expect(setPresence).toHaveBeenCalled();
  });

  it('does nothing when client.user is null', async () => {
    const client = mockClient({ user: null });
    await expect(run(client)).resolves.not.toThrow();
  });
});

describe('clientReady / birthdayScheduler', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/birthdayScheduler')).default;
  });

  it('calls schedule with birthday cron', async () => {
    scheduleMock.mockClear();
    const client = mockClient();
    await run(client);
    expect(scheduleMock).toHaveBeenCalledWith('0 8 * * *', expect.any(Function), expect.any(Object));
  });
});

describe('clientReady / channelStatsScheduler', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/channelStatsScheduler')).default;
  });

  it('calls schedule with channel stats cron', async () => {
    scheduleMock.mockClear();
    const client = mockClient();
    await run(client);
    expect(scheduleMock).toHaveBeenCalled();
  });
});

describe('clientReady / giveawayScheduler', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/giveawayScheduler')).default;
  });

  it('calls schedule with giveaway cron', async () => {
    scheduleMock.mockClear();
    const client = mockClient();
    await run(client);
    expect(scheduleMock).toHaveBeenCalledWith('*/1 * * * *', expect.any(Function), expect.any(Object));
  });
});

describe('clientReady / monthlyStatsFlush', () => {
  let run: any;
  let startScheduler: any;
  beforeAll(async () => {
    const mod = await import('../../../src/events/clientReady/monthlyStatsFlush');
    run = mod.default;
    startScheduler = mod.startMonthlyStatsFlushScheduler;
  });

  it('run is a function', () => {
    expect(typeof run).toBe('function');
  });

  it('startMonthlyStatsFlushScheduler schedules cron', () => {
    scheduleMock.mockClear();
    startScheduler();
    expect(scheduleMock).toHaveBeenCalled();
  });
});

describe('clientReady / monthlyStats', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/monthlyStats')).default;
  });

  it('registers a cron schedule', () => {
    scheduleMock.mockClear();
    const client = mockClient();
    run(client);
    expect(scheduleMock).toHaveBeenCalled();
  });
});

describe('clientReady / questionScheduler', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/questionScheduler')).default;
  });

  it('calls schedule', async () => {
    scheduleMock.mockClear();
    const client = mockClient();
    await run(client);
    expect(scheduleMock).toHaveBeenCalled();
  });
});

describe('clientReady / sendTournamentRules', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/sendTournamentRules')).default;
  });

  it('handles no tournament config', async () => {
    const client = mockClient();
    await expect(run(client)).resolves.not.toThrow();
  });
});

describe('clientReady / warnSystemMaintenance', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/warnSystemMaintenance')).default;
  });

  it('calls schedule with warn maintenance cron', async () => {
    scheduleMock.mockClear();
    await run();
    expect(scheduleMock).toHaveBeenCalled();
  });
});

describe('clientReady / vcMinuteTick', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/vcMinuteTick')).default;
  });

  it('registers cron', () => {
    scheduleMock.mockClear();
    const client = mockClient();
    run(client);
    expect(scheduleMock).toHaveBeenCalled();
  });
});

describe('clientReady / xpFlush', () => {
  let flushXp: any;
  let startXpFlushScheduler: any;
  beforeAll(async () => {
    const mod = await import('../../../src/events/clientReady/xpFlush');
    flushXp = mod.default;
    startXpFlushScheduler = mod.startXpFlushScheduler;
  });

  it('flushXp calls xpService.flush', async () => {
    const { flush } = require('../../../src/services/xpService');
    await flushXp();
    expect(flush).toHaveBeenCalled();
  });

  it('startXpFlushScheduler registers cron', () => {
    scheduleMock.mockClear();
    startXpFlushScheduler();
    expect(scheduleMock).toHaveBeenCalled();
  });
});

describe('clientReady / twitchScheduler', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/twitchScheduler')).default;
  });

  it('registers two cron schedules (thumbnail cleanup + stream check)', async () => {
    scheduleMock.mockClear();
    const client = mockClient();
    await run(client);
    expect(scheduleMock).toHaveBeenCalledTimes(2);
  });
});
