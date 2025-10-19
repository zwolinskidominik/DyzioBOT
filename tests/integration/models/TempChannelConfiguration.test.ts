import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { clearTestData } from '../helpers/seeding';
import { TempChannelConfigurationModel } from '../../../src/models/TempChannelConfiguration';

describe('TempChannelConfiguration Model (integration)', () => {
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

  it('create/read/update/delete', async () => {
    const created = await TempChannelConfigurationModel.create({ guildId: 'g1', channelId: 'c1' });
    expect(created.guildId).toBe('g1');
    await TempChannelConfigurationModel.findOneAndUpdate({ guildId: 'g1' }, { channelId: 'c2' });
    const updated = await TempChannelConfigurationModel.findOne({ guildId: 'g1' });
    expect(updated?.channelId).toBe('c2');
    await TempChannelConfigurationModel.findOneAndDelete({ guildId: 'g1' });
    expect(await TempChannelConfigurationModel.findOne({ guildId: 'g1' })).toBeNull();
  });

  it('requires fields and unique per guild', async () => {
    await expect(TempChannelConfigurationModel.create({ channelId: 'cX' } as any)).rejects.toThrow();
    await expect(TempChannelConfigurationModel.create({ guildId: 'gX' } as any)).rejects.toThrow();
    await TempChannelConfigurationModel.create({ guildId: 'gU', channelId: 'c1' });
    await expect(TempChannelConfigurationModel.create({ guildId: 'gU', channelId: 'c2' })).rejects.toThrow(/duplicate key/i);
  });

  it('allows same channelId across different guilds', async () => {
    await TempChannelConfigurationModel.create({ guildId: 'gA', channelId: 'shared' });
    await expect(TempChannelConfigurationModel.create({ guildId: 'gB', channelId: 'shared' })).resolves.toBeDefined();
  });
});
