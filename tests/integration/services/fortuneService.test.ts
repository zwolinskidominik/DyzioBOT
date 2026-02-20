import { FortuneModel, FortuneUsageModel } from '../../../src/models/Fortune';
import {
  getFortune,
  DAILY_FORTUNE_LIMIT,
} from '../../../src/services/fortuneService';

const UID = 'user-1';

/* ================================================================ */
/*  getFortune                                                       */
/* ================================================================ */
describe('getFortune', () => {
  it('returns a fortune when pool is non-empty', async () => {
    await FortuneModel.create({ content: 'You will be happy' });

    const res = await getFortune({ userId: UID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.fortune).toBe('You will be happy');
    expect(res.data.remainingToday).toBe(DAILY_FORTUNE_LIMIT - 1);
  });

  it('consumes (deletes) the drawn fortune from the pool', async () => {
    await FortuneModel.create({ content: 'One-time fortune' });

    await getFortune({ userId: UID });

    const remaining = await FortuneModel.countDocuments();
    expect(remaining).toBe(0);
  });

  it('returns NO_FORTUNES when pool is empty', async () => {
    const res = await getFortune({ userId: UID });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_FORTUNES');
  });

  it('increments daily usage count', async () => {
    await FortuneModel.create([{ content: 'f1' }, { content: 'f2' }]);

    await getFortune({ userId: UID });
    const res2 = await getFortune({ userId: UID });

    expect(res2.ok).toBe(true);
    if (!res2.ok) return;
    expect(res2.data.remainingToday).toBe(0);
  });

  it('returns RATE_LIMIT after hitting the daily cap', async () => {
    await FortuneModel.create([{ content: 'a' }, { content: 'b' }, { content: 'c' }]);

    for (let i = 0; i < DAILY_FORTUNE_LIMIT; i++) {
      await getFortune({ userId: UID });
    }

    const res = await getFortune({ userId: UID });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('RATE_LIMIT');
  });

  it('resets daily counter on a new day', async () => {
    await FortuneModel.create([{ content: 'x' }, { content: 'y' }, { content: 'z' }]);

    // exhaust today's limit
    for (let i = 0; i < DAILY_FORTUNE_LIMIT; i++) {
      await getFortune({ userId: UID });
    }

    // simulate a new day by setting lastUsedDay to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await FortuneUsageModel.updateOne(
      { userId: UID },
      { lastUsedDay: yesterday, dailyUsageCount: DAILY_FORTUNE_LIMIT }
    );

    const res = await getFortune({ userId: UID });
    expect(res.ok).toBe(true);
  });

  it('isolates usage between different users', async () => {
    await FortuneModel.create([{ content: 'p1' }, { content: 'p2' }, { content: 'p3' }, { content: 'p4' }]);

    // user-1 uses all
    for (let i = 0; i < DAILY_FORTUNE_LIMIT; i++) {
      await getFortune({ userId: 'u1' });
    }

    // user-2 should still be able to draw
    const res = await getFortune({ userId: 'u2' });
    expect(res.ok).toBe(true);
  });

  it('picks a random fortune from the pool', async () => {
    await FortuneModel.create([{ content: 'alpha' }, { content: 'beta' }]);

    const res = await getFortune({ userId: UID });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(['alpha', 'beta']).toContain(res.data.fortune);
  });
});
