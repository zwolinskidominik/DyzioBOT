/**
 * Deep tests for MonthlyStatsCache and XpCache.
 */

/* ─── MonthlyStatsCache ───────────────────────────────────────────── */
import { MonthlyStatsCache } from '../../../src/cache/monthlyStatsCache';

describe('MonthlyStatsCache', () => {
  let cache: MonthlyStatsCache;
  beforeEach(() => {
    cache = new MonthlyStatsCache();
  });

  it('starts empty', () => {
    expect(cache.size()).toBe(0);
    expect(cache.drain()).toEqual([]);
  });

  it('adds a message', () => {
    cache.addMessage('g1', 'u1', '2026-02');
    expect(cache.size()).toBe(1);
    const entries = cache.drain();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      guildId: 'g1', userId: 'u1', month: '2026-02',
      messageCount: 1, voiceMinutes: 0,
    });
  });

  it('increments message count for same key', () => {
    cache.addMessage('g1', 'u1', '2026-02');
    cache.addMessage('g1', 'u1', '2026-02');
    cache.addMessage('g1', 'u1', '2026-02');
    const entries = cache.drain();
    expect(entries[0].messageCount).toBe(3);
  });

  it('adds voice minutes', () => {
    cache.addVoiceMinutes('g1', 'u1', '2026-02', 5);
    const entries = cache.drain();
    expect(entries[0].voiceMinutes).toBe(5);
  });

  it('accumulates voice minutes', () => {
    cache.addVoiceMinutes('g1', 'u1', '2026-02', 0.5);
    cache.addVoiceMinutes('g1', 'u1', '2026-02', 0.5);
    const entries = cache.drain();
    expect(entries[0].voiceMinutes).toBe(1);
  });

  it('uses default 0.5 for voice minutes', () => {
    cache.addVoiceMinutes('g1', 'u1', '2026-02');
    const entries = cache.drain();
    expect(entries[0].voiceMinutes).toBe(0.5);
  });

  it('separates entries by key', () => {
    cache.addMessage('g1', 'u1', '2026-02');
    cache.addMessage('g1', 'u2', '2026-02');
    cache.addMessage('g2', 'u1', '2026-02');
    expect(cache.size()).toBe(3);
  });

  it('drain clears the cache', () => {
    cache.addMessage('g1', 'u1', '2026-02');
    cache.drain();
    expect(cache.size()).toBe(0);
  });

  it('combines messages and voice in same entry', () => {
    cache.addMessage('g1', 'u1', '2026-02');
    cache.addVoiceMinutes('g1', 'u1', '2026-02', 3);
    const entries = cache.drain();
    expect(entries).toHaveLength(1);
    expect(entries[0].messageCount).toBe(1);
    expect(entries[0].voiceMinutes).toBe(3);
  });
});

/* ─── flushMonthlyStats ───────────────────────────────────────────── */
jest.mock('../../../src/models/MonthlyStats', () => ({
  MonthlyStatsModel: {
    bulkWrite: jest.fn().mockResolvedValue(undefined),
  },
}));

import { flushMonthlyStats } from '../../../src/cache/monthlyStatsCache';
import monthlyStatsCache from '../../../src/cache/monthlyStatsCache';
import { MonthlyStatsModel } from '../../../src/models/MonthlyStats';

describe('flushMonthlyStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    monthlyStatsCache.drain(); // Clear
  });

  it('does nothing when cache is empty', async () => {
    await flushMonthlyStats();
    expect(MonthlyStatsModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('calls bulkWrite with entries', async () => {
    monthlyStatsCache.addMessage('g1', 'u1', '2026-02');
    monthlyStatsCache.addVoiceMinutes('g1', 'u2', '2026-02', 5);
    await flushMonthlyStats();
    expect(MonthlyStatsModel.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ updateOne: expect.any(Object) }),
      ]),
      { ordered: false }
    );
  });

  it('re-inserts entries on bulkWrite failure', async () => {
    (MonthlyStatsModel.bulkWrite as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
    monthlyStatsCache.addMessage('g1', 'u1', '2026-02');
    monthlyStatsCache.addMessage('g1', 'u1', '2026-02');
    monthlyStatsCache.addVoiceMinutes('g1', 'u1', '2026-02', 3);
    await flushMonthlyStats();
    // Entries should be re-inserted
    expect(monthlyStatsCache.size()).toBeGreaterThan(0);
  });
});

/* ─── XpCache ─────────────────────────────────────────────────────── */
jest.mock('../../../src/models/Level', () => ({
  LevelModel: {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
  },
}));

jest.mock('../../../src/services/levelNotifier', () => ({
  notifyLevelUp: jest.fn().mockResolvedValue(undefined),
}));

import { XpCache } from '../../../src/cache/xpCache';

describe('XpCache', () => {
  let cache: XpCache;
  beforeEach(() => {
    cache = new XpCache();
    jest.clearAllMocks();
  });

  it('starts empty', () => {
    expect(cache.drain()).toEqual([]);
  });

  it('adds message XP', async () => {
    await cache.addMsg('g1', 'u1', 10);
    const entries = cache.drain();
    expect(entries).toHaveLength(1);
    const [key, entry] = entries[0];
    expect(key).toBe('g1:u1');
    expect(entry.bucket.msgCount).toBe(1);
  });

  it('adds voice minute XP', async () => {
    await cache.addVcMin('g1', 'u1', 5);
    const entries = cache.drain();
    expect(entries).toHaveLength(1);
    const [, entry] = entries[0];
    expect(entry.bucket.vcMin).toBe(1);
  });

  it('accumulates XP delta', async () => {
    await cache.addMsg('g1', 'u1', 10);
    await cache.addMsg('g1', 'u1', 15);
    const entries = cache.drain();
    const [, entry] = entries[0];
    expect(entry.levelDelta).toBe(25);
    expect(entry.bucket.msgCount).toBe(2);
  });

  it('getCurrentXp returns cached value', async () => {
    await cache.addMsg('g1', 'u1', 10);
    const result = await cache.getCurrentXp('g1', 'u1');
    expect(result.xp).toBe(10);
    expect(result.level).toBe(1);
  });

  it('getCurrentXp fetches from DB when not cached', async () => {
    const result = await cache.getCurrentXp('g1', 'u99');
    expect(result.level).toBe(1);
    expect(result.xp).toBe(0);
  });

  it('invalidateUser removes from cache', async () => {
    await cache.addMsg('g1', 'u1', 10);
    cache.invalidateUser('g1', 'u1');
    expect(cache.drain()).toEqual([]);
  });

  it('drain clears all entries', async () => {
    await cache.addMsg('g1', 'u1', 10);
    await cache.addMsg('g1', 'u2', 20);
    const drained = cache.drain();
    expect(drained).toHaveLength(2);
    expect(cache.drain()).toEqual([]);
  });

  it('setClient sets the client', () => {
    const client = { user: { id: 'bot1' } } as any;
    cache.setClient(client);
    // No error
  });
});
