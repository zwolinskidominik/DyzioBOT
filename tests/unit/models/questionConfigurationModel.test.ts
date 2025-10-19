import { QuestionConfigurationModel } from '../../../src/models/QuestionConfiguration';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('QuestionConfiguration Model', () => {
  beforeAll(async () => {
    await connectTestDb();
    await QuestionConfigurationModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates minimal configuration and allows updating single field', async () => {
    await QuestionConfigurationModel.create({ guildId: 'g1', questionChannelId: 'chan1' });
    await QuestionConfigurationModel.updateOne(
      { guildId: 'g1' },
      { $set: { pingRoleId: 'role123' } }
    );
    const updated = await QuestionConfigurationModel.findOne({ guildId: 'g1' });
    expect(updated?.pingRoleId).toBe('role123');
    expect(updated?.questionChannelId).toBe('chan1');
  });
});
