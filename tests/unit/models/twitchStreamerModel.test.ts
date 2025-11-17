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

    await expect(
      TwitchStreamerModel.create({ guildId: '1', userId: 'u1', twitchChannel: 'other' })
    ).rejects.toBeDefined();

    await expect(
      TwitchStreamerModel.create({ guildId: '1', userId: 'u2', twitchChannel: 'someName' })
    ).rejects.toBeDefined();

    await expect(
      TwitchStreamerModel.create({ guildId: '2', userId: 'u1', twitchChannel: 'someName' })
    ).resolves.toBeDefined();
  });

  test('twitchChannel normalized to lowercase on save', async () => {
    const created = await TwitchStreamerModel.create({ guildId: '3', userId: 'u3', twitchChannel: 'MiXeDCase' });
    expect(created.twitchChannel).toBe('mixedcase');

    await expect(
      TwitchStreamerModel.create({ guildId: '3', userId: 'u4', twitchChannel: 'MIXEDCASE' })
    ).rejects.toBeDefined();
  });
});
