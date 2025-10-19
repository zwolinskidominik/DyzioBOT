import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { clearTestData } from '../helpers/seeding';
import { SuggestionConfigurationModel } from '../../../src/models/SuggestionConfiguration';

describe('SuggestionConfiguration Model (integration)', () => {
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

  it('creates and reads document', async () => {
    const created = await SuggestionConfigurationModel.create({ guildId: 'g1', suggestionChannelId: 'c1' });
    expect(created.guildId).toBe('g1');
    const found = await SuggestionConfigurationModel.findOne({ guildId: 'g1' });
    expect(found?.suggestionChannelId).toBe('c1');
  });

  it('updates and deletes document', async () => {
    const created = await SuggestionConfigurationModel.create({ guildId: 'g2', suggestionChannelId: 'c2' });
    await SuggestionConfigurationModel.findOneAndUpdate({ guildId: 'g2' }, { suggestionChannelId: 'c3' });
    const updated = await SuggestionConfigurationModel.findOne({ guildId: 'g2' });
    expect(updated?.suggestionChannelId).toBe('c3');
    await SuggestionConfigurationModel.findOneAndDelete({ guildId: 'g2' });
    expect(await SuggestionConfigurationModel.findOne({ guildId: 'g2' })).toBeNull();
  });

  it('requires guildId and suggestionChannelId', async () => {
    await expect(SuggestionConfigurationModel.create({ suggestionChannelId: 'cX' } as any)).rejects.toThrow();
    await expect(SuggestionConfigurationModel.create({ guildId: 'gX' } as any)).rejects.toThrow();
  });

  it('enforces unique per guildId', async () => {
    await SuggestionConfigurationModel.create({ guildId: 'gU', suggestionChannelId: 'c1' });
    await expect(SuggestionConfigurationModel.create({ guildId: 'gU', suggestionChannelId: 'c2' })).rejects.toThrow(/duplicate key/i);
  });
});
