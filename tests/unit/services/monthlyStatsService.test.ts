import { MonthlyStatsModel } from '../../../src/models/MonthlyStats';
import { MonthlyStatsConfigModel } from '../../../src/models/MonthlyStatsConfig';
import {
  getConfig,
  generateLeaderboard,
  getUserRank,
  isNewUser,
  getPersonalStats,
  getTrendEmoji,
  formatVoiceTime,
  getMonthString,
  MONTH_NAMES,
} from '../../../src/services/monthlyStatsService';

const GID = 'guild-monthly';
const MONTH = '2026-01';
const PREV = '2025-12';

beforeEach(async () => {
  await MonthlyStatsModel.deleteMany({});
  await MonthlyStatsConfigModel.deleteMany({});
});

/* ── seed helpers ─────────────────────────────────────────── */

async function seedStats(
  userId: string,
  month: string,
  messageCount: number,
  voiceMinutes: number,
) {
  await MonthlyStatsModel.create({
    guildId: GID,
    userId,
    month,
    messageCount,
    voiceMinutes,
  });
}

/* ── MONTH_NAMES (pure) ──────────────────────────────────── */

describe('MONTH_NAMES', () => {
  it('maps 12 month numbers to Polish names', () => {
    expect(Object.keys(MONTH_NAMES)).toHaveLength(12);
    expect(MONTH_NAMES['01']).toBe('STYCZEŃ');
    expect(MONTH_NAMES['12']).toBe('GRUDZIEŃ');
  });
});

/* ── getTrendEmoji (pure) ─────────────────────────────────── */

const emojis = { upvote: '⬆', downvote: '⬇', whitedash: '➡', new: '🆕' };

describe('getTrendEmoji', () => {
  it('returns new emoji for new users', () => {
    expect(getTrendEmoji(1, 0, true, emojis)).toBe('🆕');
  });

  it('returns upvote when previousRank is 0 (not found)', () => {
    expect(getTrendEmoji(3, 0, false, emojis)).toBe('⬆');
  });

  it('returns upvote when rank improved', () => {
    expect(getTrendEmoji(2, 5, false, emojis)).toBe('⬆');
  });

  it('returns downvote when rank dropped', () => {
    expect(getTrendEmoji(5, 2, false, emojis)).toBe('⬇');
  });

  it('returns whitedash when rank unchanged', () => {
    expect(getTrendEmoji(3, 3, false, emojis)).toBe('➡');
  });
});

/* ── formatVoiceTime (pure) ───────────────────────────────── */

describe('formatVoiceTime', () => {
  it('formats under 60 min as "X min"', () => {
    expect(formatVoiceTime(45)).toBe('45 min');
  });

  it('formats exactly 60 min as "1h"', () => {
    expect(formatVoiceTime(60)).toBe('1h');
  });

  it('formats 90 min as "1:30h"', () => {
    expect(formatVoiceTime(90)).toBe('1:30h');
  });

  it('pads minutes < 10 with zero', () => {
    expect(formatVoiceTime(65)).toBe('1:05h');
  });
});

/* ── getMonthString (pure) ────────────────────────────────── */

describe('getMonthString', () => {
  it('returns current month for monthsAgo=0', () => {
    const d = new Date('2026-03-15');
    expect(getMonthString(d, 0)).toBe('2026-03');
  });

  it('returns previous month for monthsAgo=1', () => {
    const d = new Date('2026-03-15');
    expect(getMonthString(d, 1)).toBe('2026-02');
  });
});

/* ── getConfig ────────────────────────────────────────────── */

describe('getConfig', () => {
  it('returns config when exists', async () => {
    await MonthlyStatsConfigModel.create({
      guildId: GID,
      enabled: true,
      channelId: 'ch-1',
      topCount: 5,
    });
    const res = await getConfig(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.enabled).toBe(true);
    expect(res.data.topCount).toBe(5);
  });

  it('fails with NO_CONFIG when not found', async () => {
    const res = await getConfig(GID);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_CONFIG');
  });
});

/* ── generateLeaderboard ──────────────────────────────────── */

describe('generateLeaderboard', () => {
  it('returns sorted top N for messages and voice', async () => {
    await seedStats('u1', MONTH, 100, 30);
    await seedStats('u2', MONTH, 200, 10);
    await seedStats('u3', MONTH, 50, 60);

    const res = await generateLeaderboard(GID, MONTH, 2);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.topMessages).toHaveLength(2);
    expect(res.data.topMessages[0].userId).toBe('u2');
    expect(res.data.topMessages[1].userId).toBe('u1');

    expect(res.data.topVoice).toHaveLength(2);
    expect(res.data.topVoice[0].userId).toBe('u3');
    expect(res.data.topVoice[1].userId).toBe('u1');

    expect(res.data.totalMessages).toBe(350);
  });

  it('returns empty arrays when no stats', async () => {
    const res = await generateLeaderboard(GID, MONTH, 10);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.topMessages).toHaveLength(0);
    expect(res.data.totalMessages).toBe(0);
  });
});

/* ── getUserRank ──────────────────────────────────────────── */

describe('getUserRank', () => {
  it('returns message rank (1-based)', async () => {
    await seedStats('u1', MONTH, 100, 0);
    await seedStats('u2', MONTH, 200, 0);
    expect(await getUserRank(GID, 'u1', MONTH, 'messages')).toBe(2);
    expect(await getUserRank(GID, 'u2', MONTH, 'messages')).toBe(1);
  });

  it('returns 0 for unknown user', async () => {
    expect(await getUserRank(GID, 'nobody', MONTH, 'messages')).toBe(0);
  });
});

/* ── isNewUser ────────────────────────────────────────────── */

describe('isNewUser', () => {
  it('returns true when user has ≤1 month record', async () => {
    await seedStats('u1', MONTH, 10, 0);
    expect(await isNewUser(GID, 'u1')).toBe(true);
  });

  it('returns false when user has 2+ records', async () => {
    await seedStats('u1', MONTH, 10, 0);
    await seedStats('u1', PREV, 5, 0);
    expect(await isNewUser(GID, 'u1')).toBe(false);
  });
});

/* ── getPersonalStats ─────────────────────────────────────── */

describe('getPersonalStats', () => {
  it('returns stats with ranking', async () => {
    await seedStats('u1', MONTH, 100, 30);
    await seedStats('u2', MONTH, 200, 10);
    await seedStats('u3', MONTH, 50, 60);

    const res = await getPersonalStats(GID, 'u1', MONTH);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.messageCount).toBe(100);
    expect(res.data.messageRank).toBe(2);
    expect(res.data.voiceRank).toBe(2);
    expect(res.data.totalUsers).toBe(3);
  });

  it('fails with NO_STATS when user not found', async () => {
    const res = await getPersonalStats(GID, 'nobody', MONTH);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_STATS');
  });
});
