import { FortuneModel, FortuneUsageModel } from '../../../src/models/Fortune';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('Fortune & FortuneUsage Models', () => {
  beforeAll(async () => {
    await connectTestDb();
    await FortuneModel.ensureIndexes();
    await FortuneUsageModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates fortune with required content', async () => {
    const f = await FortuneModel.create({ content: 'Fortune A' });
    expect(f.content).toBe('Fortune A');
  });

  it('enforces unique content', async () => {
    await FortuneModel.create({ content: 'Unique fortune' });
    await expect(
      FortuneModel.create({ content: 'Unique fortune' })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('creates FortuneUsage with defaults', async () => {
    const usage = await FortuneUsageModel.create({ userId: 'u1', targetId: 't1' });
    expect(usage.lastUsed).toBeInstanceOf(Date);
    expect(usage.lastUsedDay).toBeInstanceOf(Date);
    expect(usage.dailyUsageCount).toBe(0);
  });
});
