import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { clearTestData } from '../helpers/seeding';
import { TwitchStreamerModel } from '../../../src/models/TwitchStreamer';

describe('TwitchStreamer Model (integration)', () => {
  let db: DbManager;

  beforeAll(async () => {
    db = new DbManager();
    await db.startDb();
  });

  afterAll(async () => {
    await db.stopDb();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  afterEach(async () => {
    await clearTestData();
  });

  it('create/read/update/delete with lowercase normalization', async () => {
    const created = await TwitchStreamerModel.create({ guildId: 'g1', userId: 'u1', twitchChannel: 'MiXeD' });
    expect(created.twitchChannel).toBe('mixed');
    const found = await TwitchStreamerModel.findOne({ guildId: 'g1', userId: 'u1' });
    expect(found?.twitchChannel).toBe('mixed');
    await TwitchStreamerModel.findOneAndUpdate({ guildId: 'g1', userId: 'u1' }, { active: false });
    const updated = await TwitchStreamerModel.findOne({ guildId: 'g1', userId: 'u1' });
    expect(updated?.active).toBe(false);
    await TwitchStreamerModel.deleteOne({ guildId: 'g1', userId: 'u1' });
    expect(await TwitchStreamerModel.findOne({ guildId: 'g1', userId: 'u1' })).toBeNull();
  });

  it('unique per (guildId,userId) and per (guildId,twitchChannel)', async () => {
    await TwitchStreamerModel.create({ guildId: 'gU', userId: 'u1', twitchChannel: 'ch1' });
    await expect(TwitchStreamerModel.create({ guildId: 'gU', userId: 'u1', twitchChannel: 'other' })).rejects.toBeDefined();
    await expect(TwitchStreamerModel.create({ guildId: 'gU', userId: 'u2', twitchChannel: 'CH1' })).rejects.toBeDefined();
    await expect(TwitchStreamerModel.create({ guildId: 'gX', userId: 'u1', twitchChannel: 'ch1' })).resolves.toBeDefined();
  });
});
