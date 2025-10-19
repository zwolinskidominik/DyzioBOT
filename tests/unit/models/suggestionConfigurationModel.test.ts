import { SuggestionConfigurationModel } from '../../../src/models/SuggestionConfiguration';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('SuggestionConfiguration Model', () => {
  beforeAll(async () => {
    await connectTestDb();
    await SuggestionConfigurationModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates minimal configuration and persists fields', async () => {
    const cfg = await SuggestionConfigurationModel.create({
      guildId: 'g1',
      suggestionChannelId: 'chan1',
    });
    expect(cfg.guildId).toBe('g1');
    expect(cfg.suggestionChannelId).toBe('chan1');
  });
});
