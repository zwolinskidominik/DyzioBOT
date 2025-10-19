import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';
import mongoose from 'mongoose';
import { ActivityBucketModel } from '../../../src/models/ActivityBucket';

describe('Model ActivityBucket', () => {
  beforeAll(async () => { await connectTestDb(); await ActivityBucketModel.ensureIndexes(); });
  afterEach(async () => { await clearDatabase(); });
  afterAll(async () => { await disconnectTestDb(); });

  test('creates with required fields & defaults (msgCount, vcMin=0)', async () => {
    const start = new Date();
    const doc = await ActivityBucketModel.create({ guildId: 'g1', userId: 'u1', bucketStart: start });
    expect(doc.msgCount).toBe(0);
    expect(doc.vcMin).toBe(0);
    expect(doc.guildId).toBe('g1');
  });

  test('missing required guildId fails', async () => {
    const start = new Date();
    await expect(ActivityBucketModel.create({ userId: 'u1', bucketStart: start } as any))
      .rejects.toThrow();
  });

  test('unique index (guildId,userId,bucketStart) enforced', async () => {
    const start = new Date();
    await ActivityBucketModel.create({ guildId: 'g2', userId: 'u2', bucketStart: start });
    await expect(ActivityBucketModel.create({ guildId: 'g2', userId: 'u2', bucketStart: start }))
      .rejects.toThrow();
  });

  test('increment counters and save persists', async () => {
    const start = new Date();
    const doc = await ActivityBucketModel.create({ guildId: 'g3', userId: 'u3', bucketStart: start });
    doc.msgCount += 5;
    doc.vcMin += 11;
    await doc.save();
    const found = await ActivityBucketModel.findOne({ guildId: 'g3', userId: 'u3' }).lean();
    expect(found?.msgCount).toBe(5);
    expect(found?.vcMin).toBe(11);
  });
});
