import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';
import { TwitchStreamerModel } from '../../../src/models/TwitchStreamer';

beforeAll(async () => {
  await connectTestDb();
  await TwitchStreamerModel.ensureIndexes();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe('TwitchStreamer model', () => {
  test('unique per guild + user and per guild + twitchChannel', async () => {
    await TwitchStreamerModel.create({ guildId: '1', userId: 'u1', twitchChannel: 'someName' });

    // same guild+user rejected
    await expect(
      TwitchStreamerModel.create({ guildId: '1', userId: 'u1', twitchChannel: 'other' })
    ).rejects.toBeDefined();

    // same guild+twitchChannel rejected (different user)
    await expect(
      TwitchStreamerModel.create({ guildId: '1', userId: 'u2', twitchChannel: 'someName' })
    ).rejects.toBeDefined();

    // different guild ok
    await expect(
      TwitchStreamerModel.create({ guildId: '2', userId: 'u1', twitchChannel: 'someName' })
    ).resolves.toBeDefined();
  });

  test('twitchChannel normalized to lowercase on save', async () => {
    const created = await TwitchStreamerModel.create({ guildId: '3', userId: 'u3', twitchChannel: 'MiXeDCase' });
    expect(created.twitchChannel).toBe('mixedcase');

    // try to insert same name with different case -> uniqueness by (guildId, twitchChannel) should block
    await expect(
      TwitchStreamerModel.create({ guildId: '3', userId: 'u4', twitchChannel: 'MIXEDCASE' })
    ).rejects.toBeDefined();
  });
});
