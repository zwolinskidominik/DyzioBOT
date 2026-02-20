jest.mock('../../../src/models/MonthlyStats', () => ({
  MonthlyStatsModel: { bulkWrite: jest.fn() },
}));

import { MonthlyStatsCache, flushMonthlyStats } from '../../../src/cache/monthlyStatsCache';
import { MonthlyStatsModel } from '../../../src/models/MonthlyStats';

describe('MonthlyStatsCache', () => {
  let cache: MonthlyStatsCache;

  beforeEach(() => {
    cache = new MonthlyStatsCache();
  });

  describe('addMessage', () => {
    it('creates entry with messageCount=1 for new key', () => {
      cache.addMessage('g1', 'u1', '2026-02');
      const entries = cache.drain();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        guildId: 'g1',
        userId: 'u1',
        month: '2026-02',
        messageCount: 1,
        voiceMinutes: 0,
      });
    });

    it('increments messageCount for existing key', () => {
      cache.addMessage('g1', 'u1', '2026-02');
      cache.addMessage('g1', 'u1', '2026-02');
      cache.addMessage('g1', 'u1', '2026-02');
      const entries = cache.drain();
      expect(entries[0].messageCount).toBe(3);
    });

    it('treats different months as separate keys', () => {
      cache.addMessage('g1', 'u1', '2026-01');
      cache.addMessage('g1', 'u1', '2026-02');
      expect(cache.size()).toBe(2);
    });
  });

  describe('addVoiceMinutes', () => {
    it('creates entry with voiceMinutes for new key', () => {
      cache.addVoiceMinutes('g1', 'u1', '2026-02', 2);
      const entries = cache.drain();
      expect(entries[0].voiceMinutes).toBe(2);
      expect(entries[0].messageCount).toBe(0);
    });

    it('uses default of 0.5 when no minutes param', () => {
      cache.addVoiceMinutes('g1', 'u1', '2026-02');
      const entries = cache.drain();
      expect(entries[0].voiceMinutes).toBe(0.5);
    });

    it('accumulates voice minutes', () => {
      cache.addVoiceMinutes('g1', 'u1', '2026-02', 1);
      cache.addVoiceMinutes('g1', 'u1', '2026-02', 1.5);
      const entries = cache.drain();
      expect(entries[0].voiceMinutes).toBe(2.5);
    });
  });

  describe('size', () => {
    it('returns 0 for empty cache', () => {
      expect(cache.size()).toBe(0);
    });

    it('returns correct count', () => {
      cache.addMessage('g1', 'u1', '2026-02');
      cache.addMessage('g1', 'u2', '2026-02');
      expect(cache.size()).toBe(2);
    });
  });

  describe('drain', () => {
    it('returns all entries and clears', () => {
      cache.addMessage('g1', 'u1', '2026-02');
      cache.addVoiceMinutes('g1', 'u2', '2026-02', 1);
      const entries = cache.drain();
      expect(entries).toHaveLength(2);
      expect(cache.size()).toBe(0);
    });
  });

  describe('combined message + voice', () => {
    it('both accumulate on same key', () => {
      cache.addMessage('g1', 'u1', '2026-02');
      cache.addVoiceMinutes('g1', 'u1', '2026-02', 3);
      const entries = cache.drain();
      expect(entries[0].messageCount).toBe(1);
      expect(entries[0].voiceMinutes).toBe(3);
    });
  });
});

describe('flushMonthlyStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when cache is empty', async () => {
    await flushMonthlyStats();
    expect(MonthlyStatsModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('calls bulkWrite with correct operations', async () => {
    (MonthlyStatsModel.bulkWrite as jest.Mock).mockResolvedValue({});

    // Need to import the default singleton instance to add data
    // Instead, call the function from the module (it uses the singleton)
    const monthlyStatsCache = (await import('../../../src/cache/monthlyStatsCache')).default;
    monthlyStatsCache.addMessage('g1', 'u1', '2026-02');
    monthlyStatsCache.addVoiceMinutes('g1', 'u2', '2026-02', 5);

    await flushMonthlyStats();

    expect(MonthlyStatsModel.bulkWrite).toHaveBeenCalledTimes(1);
    const ops = (MonthlyStatsModel.bulkWrite as jest.Mock).mock.calls[0][0];
    expect(ops).toHaveLength(2);
    expect(ops[0].updateOne.filter).toMatchObject({ guildId: 'g1', userId: 'u1', month: '2026-02' });
    expect(ops[0].updateOne.update.$inc.messageCount).toBe(1);
    expect(ops[1].updateOne.filter).toMatchObject({ guildId: 'g1', userId: 'u2', month: '2026-02' });
    expect(ops[1].updateOne.update.$inc.voiceMinutes).toBe(5);
    expect(ops[0].updateOne.upsert).toBe(true);
  });

  it('re-queues entries on bulkWrite failure', async () => {
    (MonthlyStatsModel.bulkWrite as jest.Mock).mockRejectedValue(new Error('DB error'));

    const monthlyStatsCache = (await import('../../../src/cache/monthlyStatsCache')).default;
    monthlyStatsCache.addMessage('g1', 'u1', '2026-02');
    monthlyStatsCache.addMessage('g1', 'u1', '2026-02'); // 2 messages

    await flushMonthlyStats(); // fails → re-queue

    // Data should be back in the cache
    expect(monthlyStatsCache.size()).toBeGreaterThan(0);
    const entries = monthlyStatsCache.drain();
    expect(entries.find(e => e.userId === 'u1')!.messageCount).toBe(2);
  });
});
