import { GreetingsConfigurationModel } from '../../../src/models/GreetingsConfiguration';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('GreetingsConfiguration Model', () => {
  beforeAll(async () => {
    await connectTestDb();
    await GreetingsConfigurationModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('applies default toggles (welcome=true, goodbye=true, dm=false)', async () => {
    const doc = await GreetingsConfigurationModel.create({
      guildId: 'g1',
      greetingsChannelId: 'chan1',
    });
    expect(doc.welcomeEnabled).toBe(true);
    expect(doc.goodbyeEnabled).toBe(true);
    expect(doc.dmEnabled).toBe(false);
  });

  it('updates single toggle without losing others', async () => {
    await GreetingsConfigurationModel.create({ guildId: 'g2', greetingsChannelId: 'chan2' });
    await GreetingsConfigurationModel.updateOne({ guildId: 'g2' }, { $set: { dmEnabled: true } });
    const updated = await GreetingsConfigurationModel.findOne({ guildId: 'g2' });
    expect(updated?.dmEnabled).toBe(true);
    expect(updated?.welcomeEnabled).toBe(true);
    expect(updated?.goodbyeEnabled).toBe(true);
  });

  it('enforces unique guildId', async () => {
    await GreetingsConfigurationModel.create({ guildId: 'g3', greetingsChannelId: 'chan3' });
    await expect(
      GreetingsConfigurationModel.create({ guildId: 'g3', greetingsChannelId: 'chanX' })
    ).rejects.toThrow(/duplicate key/i);
  });
});
