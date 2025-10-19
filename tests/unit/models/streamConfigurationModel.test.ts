import { StreamConfigurationModel } from '../../../src/models/StreamConfiguration';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('StreamConfiguration Model', () => {
  beforeAll(async () => {
    await connectTestDb();
    await StreamConfigurationModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates with valid numeric channelId', async () => {
    const sc = await StreamConfigurationModel.create({ guildId: 'g3', channelId: '123456789012345678' });
    expect(sc.channelId).toBe('123456789012345678');
  });

  it('rejects non-numeric channelId', async () => {
    await expect(
      StreamConfigurationModel.create({ guildId: 'g4', channelId: 'abc123' })
    ).rejects.toThrow(/validation/i);
  });
});
