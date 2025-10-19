import { TempChannelModel } from '../../../src/models/TempChannel';
import { TempChannelConfigurationModel } from '../../../src/models/TempChannelConfiguration';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';

describe('TempChannel & TempChannelConfiguration Models', () => {
  beforeAll(async () => {
    await connectTestDb();
    await TempChannelModel.ensureIndexes();
    await TempChannelConfigurationModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('enforces unique (guildId, channelId) in TempChannel', async () => {
    await TempChannelModel.create({
      guildId: 'g1',
      parentId: 'parent',
      channelId: 'ch1',
      ownerId: 'owner1',
    });
    await expect(
      TempChannelModel.create({
        guildId: 'g1',
        parentId: 'parent',
        channelId: 'ch1',
        ownerId: 'owner2',
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  // no TTL field check per user request (expiresAt removed)

  it('TempChannelConfiguration unique per guild', async () => {
    await TempChannelConfigurationModel.create({ guildId: 'gX', channelId: 'c1' });
    await expect(
      TempChannelConfigurationModel.create({ guildId: 'gX', channelId: 'c2' })
    ).rejects.toThrow(/duplicate key/i);
  });

  it('TempChannelConfiguration requires guildId field', async () => {
    await expect(
      TempChannelConfigurationModel.create({ channelId: 'ch1' } as any)
    ).rejects.toThrow();
  });

  it('TempChannelConfiguration requires channelId field', async () => {
    await expect(
      TempChannelConfigurationModel.create({ guildId: 'g1' } as any)
    ).rejects.toThrow();
  });

  it('TempChannelConfiguration allows different guilds with same channelId', async () => {
    const config1 = await TempChannelConfigurationModel.create({ 
      guildId: 'guild1', 
      channelId: 'channel1' 
    });
    const config2 = await TempChannelConfigurationModel.create({ 
      guildId: 'guild2', 
      channelId: 'channel1' 
    });
    
    expect(config1.guildId).toBe('guild1');
    expect(config2.guildId).toBe('guild2');
    expect(config1.channelId).toBe('channel1');
    expect(config2.channelId).toBe('channel1');
  });

  it('TempChannelConfiguration basic CRUD operations', async () => {
    // Create
    const created = await TempChannelConfigurationModel.create({
      guildId: 'testGuild',
      channelId: 'testChannel',
    });
    expect(created.guildId).toBe('testGuild');
    expect(created.channelId).toBe('testChannel');

    // Read
    const found = await TempChannelConfigurationModel.findOne({ guildId: 'testGuild' });
    expect(found?.channelId).toBe('testChannel');

    // Update
    const updated = await TempChannelConfigurationModel.findOneAndUpdate(
      { guildId: 'testGuild' },
      { channelId: 'updatedChannel' },
      { new: true }
    );
    expect(updated?.channelId).toBe('updatedChannel');

    // Delete
    await TempChannelConfigurationModel.findOneAndDelete({ guildId: 'testGuild' });
    const deleted = await TempChannelConfigurationModel.findOne({ guildId: 'testGuild' });
    expect(deleted).toBeNull();
  });
});
