import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { clearTestData } from '../helpers/seeding';
import { TicketStatsModel } from '../../../src/models/TicketStats';

describe('TicketStats Model (integration)', () => {
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

  it('create default count=0, increment and read', async () => {
    const created = await TicketStatsModel.create({ guildId: 'g1', userId: 'u1' });
    expect(created.count).toBe(0);
    await TicketStatsModel.updateOne({ guildId: 'g1', userId: 'u1' }, { $inc: { count: 2 } }).exec();
    const found = await TicketStatsModel.findOne({ guildId: 'g1', userId: 'u1' });
    expect(found?.count).toBe(2);
  });

  it('unique composite (guildId,userId)', async () => {
    await TicketStatsModel.create({ guildId: 'gU', userId: 'u1' });
    await expect(TicketStatsModel.create({ guildId: 'gU', userId: 'u1' })).rejects.toThrow(/duplicate key/i);
    await expect(TicketStatsModel.create({ guildId: 'gU', userId: 'u2' })).resolves.toBeDefined();
  });

  it('delete entry', async () => {
    await TicketStatsModel.create({ guildId: 'g2', userId: 'u2' });
    await TicketStatsModel.deleteOne({ guildId: 'g2', userId: 'u2' });
    expect(await TicketStatsModel.findOne({ guildId: 'g2', userId: 'u2' })).toBeNull();
  });
});
