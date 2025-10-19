import { ChannelStatsModel } from '../../../src/models/ChannelStats';
import {
  connectTestDb,
  clearDatabase,
  disconnectTestDb,
} from '../helpers/connectTestDb';

describe('ChannelStats Model', () => {
  beforeAll(async () => {
    await connectTestDb();
    await ChannelStatsModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const baseChannels = () => ({
    lastJoined: { channelId: 'cLast', template: 'Last: {member}', member: undefined },
    users: { channelId: 'cUsers', template: 'Users: {count}' },
    bots: { channelId: 'cBots', template: 'Bots: {count}' },
    bans: { channelId: 'cBans', template: 'Bans: {count}' },
  });

  it('requires guildId', async () => {
    await expect(
      ChannelStatsModel.create({ channels: baseChannels() } as any)
    ).rejects.toThrow();
  });

  it('requires channels object', async () => {
    await expect(
      ChannelStatsModel.create({ guildId: 'g1' } as any)
    ).rejects.toThrow();
  });

  it('persists nested channel updates sequentially', async () => {
    const doc = await ChannelStatsModel.create({ guildId: 'gSeq', channels: baseChannels() });
    doc.channels.users!.template = 'Users: 10';
    await doc.save();
    const reloaded = await ChannelStatsModel.findOne({ guildId: 'gSeq' });
    expect(reloaded?.channels.users?.template).toBe('Users: 10');
    reloaded!.channels.lastJoined!.member = 'member123';
    await reloaded!.save();
    const finalDoc = await ChannelStatsModel.findOne({ guildId: 'gSeq' });
    expect(finalDoc?.channels.lastJoined?.member).toBe('member123');
  });

  it('handles concurrent updates to different nested fields (Promise.all)', async () => {
    await ChannelStatsModel.create({ guildId: 'gConc', channels: baseChannels() });

    await Promise.all([
      ChannelStatsModel.updateOne(
        { guildId: 'gConc' },
        { $set: { 'channels.users.template': 'Users: 5' } }
      ),
      ChannelStatsModel.updateOne(
        { guildId: 'gConc' },
        { $set: { 'channels.bots.template': 'Bots: 2' } }
      ),
      ChannelStatsModel.updateOne(
        { guildId: 'gConc' },
        { $set: { 'channels.bans.template': 'Bans: 1' } }
      ),
      ChannelStatsModel.updateOne(
        { guildId: 'gConc' },
        { $set: { 'channels.lastJoined.member': 'userXYZ' } }
      ),
    ]);

    const updated = await ChannelStatsModel.findOne({ guildId: 'gConc' });
    expect(updated?.channels.users?.template).toBe('Users: 5');
    expect(updated?.channels.bots?.template).toBe('Bots: 2');
    expect(updated?.channels.bans?.template).toBe('Bans: 1');
    expect(updated?.channels.lastJoined?.member).toBe('userXYZ');
  });
});
