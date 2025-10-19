import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { clearTestData } from '../helpers/seeding';
import { StreamConfigurationModel } from '../../../src/models/StreamConfiguration';

describe('StreamConfiguration Model (integration)', () => {
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
    const created = await StreamConfigurationModel.create({ guildId: 'g1', channelId: '123456789012345678' });
    expect(created.channelId).toBe('123456789012345678');
    await StreamConfigurationModel.findOneAndUpdate({ guildId: 'g1' }, { channelId: '987654321098765432' });
    const updated = await StreamConfigurationModel.findOne({ guildId: 'g1' });
    expect(updated?.channelId).toBe('987654321098765432');
    await StreamConfigurationModel.findOneAndDelete({ guildId: 'g1' });
    expect(await StreamConfigurationModel.findOne({ guildId: 'g1' })).toBeNull();
  });

  it('requires fields and validates numeric channelId', async () => {
    await expect(StreamConfigurationModel.create({ channelId: '1' } as any)).rejects.toThrow();
    await expect(StreamConfigurationModel.create({ guildId: 'g2', channelId: 'abc' } as any)).rejects.toThrow(/validation/i);
  });

  it('unique per guildId', async () => {
    await StreamConfigurationModel.create({ guildId: 'gU', channelId: '123' });
    await expect(StreamConfigurationModel.create({ guildId: 'gU', channelId: '456' })).rejects.toThrow(/duplicate key/i);
  });
});
