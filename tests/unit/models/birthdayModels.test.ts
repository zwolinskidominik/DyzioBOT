import { BirthdayModel } from '../../../src/models/Birthday';
import { BirthdayConfigurationModel } from '../../../src/models/BirthdayConfiguration';
import {
  connectTestDb,
  clearDatabase,
  disconnectTestDb,
} from '../helpers/connectTestDb';

describe('Birthday & BirthdayConfiguration Models', () => {
  beforeAll(async () => {
    await connectTestDb();
    await BirthdayModel.ensureIndexes();
    await BirthdayConfigurationModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates Birthday with default flags (yearSpecified, active) true', async () => {
    const doc = await BirthdayModel.create({
      userId: 'user1',
      guildId: 'guild1',
      date: new Date('2000-05-10'),
    });
    expect(doc.yearSpecified).toBe(true);
    expect(doc.active).toBe(true);
  });

  it('requires date field', async () => {
    await expect(
      BirthdayModel.create({ userId: 'u1', guildId: 'g1' } as any)
    ).rejects.toThrow();
  });

  it('requires userId & guildId', async () => {
    await expect(
      BirthdayModel.create({ date: new Date(), guildId: 'g1' } as any)
    ).rejects.toThrow();
    await expect(
      BirthdayModel.create({ date: new Date(), userId: 'u1' } as any)
    ).rejects.toThrow();
  });

  it('enforces unique (userId, guildId)', async () => {
    await BirthdayModel.create({
      userId: 'u1',
      guildId: 'g1',
      date: new Date('1999-01-01'),
    });
    await expect(
      BirthdayModel.create({
        userId: 'u1',
        guildId: 'g1',
        date: new Date('2001-02-02'),
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('rejects invalid date value', async () => {
    await expect(
      BirthdayModel.create({
        userId: 'u2',
        guildId: 'g1',
        date: 'not-a-date' as any,
      })
    ).rejects.toThrow();
  });

  it('creates BirthdayConfiguration and Birthday for the same guild', async () => {
    const cfg = await BirthdayConfigurationModel.create({
      guildId: 'guildX',
      birthdayChannelId: 'chan123',
    });
    const bday = await BirthdayModel.create({
      userId: 'userX',
      guildId: 'guildX',
      date: new Date('1995-12-24'),
    });

    const foundCfg = await BirthdayConfigurationModel.findOne({ guildId: 'guildX' });
    const foundBday = await BirthdayModel.findOne({ guildId: 'guildX', userId: 'userX' });
    expect(foundCfg?.birthdayChannelId).toBe(cfg.birthdayChannelId);
    expect(foundBday?.date.toISOString()).toBe(bday.date.toISOString());
  });

  it('enforces unique BirthdayConfiguration per guild', async () => {
    await BirthdayConfigurationModel.create({
      guildId: 'guildSingle',
      birthdayChannelId: 'chanA',
    });
    await expect(
      BirthdayConfigurationModel.create({
        guildId: 'guildSingle',
        birthdayChannelId: 'chanB',
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('requires birthdayChannelId in BirthdayConfiguration', async () => {
    await expect(
      BirthdayConfigurationModel.create({ guildId: 'gMissing' } as any)
    ).rejects.toThrow();
  });
});
