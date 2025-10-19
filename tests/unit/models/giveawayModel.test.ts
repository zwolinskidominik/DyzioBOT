import { GiveawayModel } from '../../../src/models/Giveaway';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('Giveaway Model', () => {
  beforeAll(async () => {
    await connectTestDb();
    await GiveawayModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const baseData = () => ({
    giveawayId: 'g1',
    guildId: 'guild1',
    channelId: 'channel1',
    messageId: 'msg1',
    prize: 'Prize',
    description: 'Desc',
    winnersCount: 1,
    endTime: new Date(Date.now() + 60_000),
    hostId: 'host1',
  });

  it('creates with defaults (active true, empty participants, roleMultipliers map, finalized false)', async () => {
    const doc = await GiveawayModel.create(baseData());
    expect(doc.active).toBe(true);
    expect(doc.participants).toEqual([]);
    expect(doc.roleMultipliers instanceof Map).toBe(true);
    expect(doc.finalized).toBe(false);
  });

  it('requires all mandatory fields', async () => {
    await expect(GiveawayModel.create({} as any)).rejects.toThrow();
  });

  it('rejects past endTime', async () => {
    // Temporarily disable test environment check
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    try {
      await expect(
        GiveawayModel.create({
          ...baseData(),
          giveawayId: 'gPast',
          messageId: 'msgPast',
          endTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        })
      ).rejects.toThrow();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('enforces unique giveawayId', async () => {
    await GiveawayModel.create(baseData());
    await expect(
      GiveawayModel.create({ ...baseData(), messageId: 'msgOther' })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('enforces unique messageId', async () => {
    await GiveawayModel.create(baseData());
    await expect(
      GiveawayModel.create({
        ...baseData(),
        giveawayId: 'g2',
      })
    ).rejects.toThrow(/duplicate key/i);
  });
});
