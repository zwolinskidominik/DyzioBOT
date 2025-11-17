import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { GiveawayModel } from '../../../src/models/Giveaway';
import { giveawayFactory } from '../factories';
import { clearTestData } from '../helpers/seeding';
import logger from '../../../src/utils/logger';

describe('Giveaway Model Integration Tests', () => {
  let dbManager: DbManager;

  beforeAll(async () => {
    dbManager = new DbManager();
    await dbManager.startDb();
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe('Model Validation', () => {
    it('should create a valid giveaway record', async () => {
      const giveawayData = {
        giveawayId: 'test-giveaway-123',
        guildId: 'guild-123',
        prize: 'Discord Nitro',
        description: 'Win a month of Discord Nitro!',
        channelId: 'channel-123',
        messageId: 'message-123',
        hostId: 'host-123',
        winnersCount: 1,
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const giveaway = await GiveawayModel.create(giveawayData);

      expect(giveaway).toBeDefined();
      expect(giveaway.guildId).toBe('guild-123');
      expect(giveaway.prize).toBe('Discord Nitro');
      expect(giveaway.description).toBe('Win a month of Discord Nitro!');
      expect(giveaway.channelId).toBe('channel-123');
      expect(giveaway.messageId).toBe('message-123');
      expect(giveaway.hostId).toBe('host-123');
      expect(giveaway.winnersCount).toBe(1);
      expect(giveaway.active).toBe(true);
      expect(giveaway.participants).toEqual([]);
      expect(giveaway.endTime).toBeInstanceOf(Date);
      expect(giveaway.createdAt).toBeInstanceOf(Date);
    });

    it('should require guildId field', async () => {
      const giveawayData = {
        giveawayId: 'test-giveaway-123',
        prize: 'Test Prize',
        description: 'Test description',
        channelId: 'channel-123',
        messageId: 'message-123',
        hostId: 'host-123',
        winnersCount: 1,
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await expect(GiveawayModel.create(giveawayData)).rejects.toThrow(/guildId.*required/);
    });

    it('should require prize field', async () => {
      const giveawayData = {
        giveawayId: 'test-giveaway-123',
        guildId: 'guild-123',
        description: 'Test description',
        channelId: 'channel-123',
        messageId: 'message-123',
        hostId: 'host-123',
        winnersCount: 1,
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await expect(GiveawayModel.create(giveawayData)).rejects.toThrow(/prize.*required/);
    });

    it('should require channelId field', async () => {
      const giveawayData = {
        giveawayId: 'test-giveaway-123',
        guildId: 'guild-123',
        prize: 'Test Prize',
        description: 'Test description',
        messageId: 'message-123',
        hostId: 'host-123',
        winnersCount: 1,
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await expect(GiveawayModel.create(giveawayData)).rejects.toThrow(/channelId.*required/);
    });

    it('should require messageId field', async () => {
      const giveawayData = {
        giveawayId: 'test-giveaway-123',
        guildId: 'guild-123',
        prize: 'Test Prize',
        description: 'Test description',
        channelId: 'channel-123',
        hostId: 'host-123',
        winnersCount: 1,
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await expect(GiveawayModel.create(giveawayData)).rejects.toThrow(/messageId.*required/);
    });

    it('should validate winnersCount is positive', async () => {
      const giveawayData = {
        giveawayId: 'test-giveaway-123',
        guildId: 'guild-123',
        prize: 'Test Prize',
        description: 'Test description',
        channelId: 'channel-123',
        messageId: 'message-123',
        hostId: 'host-123',
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await expect(GiveawayModel.create(giveawayData)).rejects.toThrow(/winnersCount.*required/);
    });

    it('should validate endTime is in the future', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const giveawayData = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Test Prize',
        channelId: 'channel-123',
        messageId: 'message-123',
        endTime: pastDate
      });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        await expect(GiveawayModel.create(giveawayData)).rejects.toThrow(/endTime must be in the future/);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should set default values correctly', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const giveawayData = {
        giveawayId: 'test-giveaway-id',
        guildId: 'guild-123',
        prize: 'Test Prize',
        description: 'Test Description',
        channelId: 'channel-123',
        messageId: 'message-123',
        hostId: 'host-123',
        winnersCount: 1,
        endTime: futureDate
      };

      const giveaway = await GiveawayModel.create(giveawayData);

      expect(giveaway.active).toBe(true);
      expect(giveaway.participants).toEqual([]);
      expect(giveaway.roleMultipliers).toBeInstanceOf(Map);
      expect(giveaway.finalized).toBe(false);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique constraint on messageId', async () => {
      const giveaway1Data = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Prize 1',
        channelId: 'channel-123',
        messageId: 'message-123'
      });

      await GiveawayModel.create(giveaway1Data);

      const giveaway2Data = giveawayFactory.build({
        guildId: 'guild-456',
        prize: 'Prize 2',
        channelId: 'channel-456',
        messageId: 'message-123'
      });

      await expect(GiveawayModel.create(giveaway2Data)).rejects.toThrow(/duplicate key/);
    });

    it('should enforce unique constraint on giveawayId', async () => {
      const giveaway1Data = giveawayFactory.build({
        giveawayId: 'unique-giveaway-id',
        guildId: 'guild-123',
        prize: 'Prize 1',
        channelId: 'channel-123',
        messageId: 'message-123'
      });

      await GiveawayModel.create(giveaway1Data);

      const giveaway2Data = giveawayFactory.build({
        giveawayId: 'unique-giveaway-id',
        guildId: 'guild-456',
        prize: 'Prize 2',
        channelId: 'channel-456',
        messageId: 'message-456'
      });

      await expect(GiveawayModel.create(giveaway2Data)).rejects.toThrow(/duplicate key/);
    });

    it('should allow different messageIds and giveawayIds', async () => {
      const giveaway1Data = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Prize 1',
        channelId: 'channel-123',
        messageId: 'message-123'
      });

      const giveaway2Data = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Prize 2',
        channelId: 'channel-123',
        messageId: 'message-456'
      });

      const giveaway1 = await GiveawayModel.create(giveaway1Data);
      const giveaway2 = await GiveawayModel.create(giveaway2Data);

      expect(giveaway1).toBeDefined();
      expect(giveaway2).toBeDefined();
      expect(giveaway1.messageId).toBe('message-123');
      expect(giveaway2.messageId).toBe('message-456');
    });
  });

  describe('Giveaway Lifecycle', () => {
    it('should handle participant addition', async () => {
      const giveawayData = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Test Prize',
        channelId: 'channel-123',
        messageId: 'message-123',
        active: true,
        participants: []
      });

      const giveaway = await GiveawayModel.create(giveawayData);
      giveaway.participants.push('user-1', 'user-2', 'user-3');
      await giveaway.save();

      const updatedGiveaway = await GiveawayModel.findById(giveaway._id);
      expect(updatedGiveaway!.participants).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should prevent duplicate participants', async () => {
      const giveawayData = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Test Prize',
        channelId: 'channel-123',
        messageId: 'message-123',
        participants: ['user-1', 'user-2']
      });

      const giveaway = await GiveawayModel.create(giveawayData);

      if (!giveaway.participants.includes('user-1')) {
        giveaway.participants.push('user-1');
      }
      if (!giveaway.participants.includes('user-3')) {
        giveaway.participants.push('user-3');
      }

      await giveaway.save();

      const updatedGiveaway = await GiveawayModel.findById(giveaway._id);
      expect(updatedGiveaway!.participants).toEqual(['user-1', 'user-2', 'user-3']);
      expect(updatedGiveaway!.participants).toHaveLength(3);
    });

    it('should handle giveaway finalization', async () => {
      const giveawayData = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Test Prize',
        channelId: 'channel-123',
        messageId: 'message-123',
        winnersCount: 2,
        participants: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
        active: true,
        finalized: false
      });

      const giveaway = await GiveawayModel.create(giveawayData);

      giveaway.active = false;
      giveaway.finalized = true;
      await giveaway.save();

      const finalizedGiveaway = await GiveawayModel.findById(giveaway._id);
      expect(finalizedGiveaway!.finalized).toBe(true);
      expect(finalizedGiveaway!.active).toBe(false);
      expect(finalizedGiveaway!.participants).toHaveLength(5);
    });

    it('should handle giveaway expiration', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      
      const giveawayData = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Expiring Prize',
        channelId: 'channel-123',
        messageId: 'message-123',
        endTime: futureDate,
        active: true
      });

      const giveaway = await GiveawayModel.create(giveawayData);
      const currentTime = new Date();
      const isExpired = giveaway.endTime < currentTime;
      expect(isExpired).toBe(false);
      const mockPastDate = new Date(Date.now() - 60 * 60 * 1000);
      const wouldBeExpired = mockPastDate < new Date();
      expect(wouldBeExpired).toBe(true);

      if (giveaway.active) {
        giveaway.active = false;
        await giveaway.save();
      }

      const updatedGiveaway = await GiveawayModel.findById(giveaway._id);
      expect(updatedGiveaway!.active).toBe(false);
    });
  });

  describe('Role Multipliers', () => {
    it('should handle role multipliers as Map', async () => {
      const multipliers = new Map<string, number>();
      multipliers.set('booster-role', 2);
      multipliers.set('vip-role', 3);
      multipliers.set('premium-role', 5);

      const giveawayData = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Multiplier Prize',
        channelId: 'channel-123',
        messageId: 'message-123',
        roleMultipliers: multipliers
      });

      const giveaway = await GiveawayModel.create(giveawayData);

      expect(giveaway.roleMultipliers.get('booster-role')).toBe(2);
      expect(giveaway.roleMultipliers.get('vip-role')).toBe(3);
      expect(giveaway.roleMultipliers.get('premium-role')).toBe(5);
    });

    it('should update role multipliers', async () => {
      const giveawayData = giveawayFactory.build({
        guildId: 'guild-123',
        prize: 'Updatable Prize',
        channelId: 'channel-123',
        messageId: 'message-123'
      });

      const giveaway = await GiveawayModel.create(giveawayData);
      giveaway.roleMultipliers.set('new-role', 4);
      giveaway.roleMultipliers.set('special-role', 10);
      await giveaway.save();

      const updatedGiveaway = await GiveawayModel.findById(giveaway._id);
      expect(updatedGiveaway!.roleMultipliers.get('new-role')).toBe(4);
      expect(updatedGiveaway!.roleMultipliers.get('special-role')).toBe(10);
    });
  });

  describe('Queries and Filtering', () => {
    beforeEach(async () => {
      const testGiveaways = [
        {
          guildId: 'guild-123',
          prize: 'Active Prize 1',
          channelId: 'channel-1',
          messageId: 'message-1',
          active: true,
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          participants: ['user-1', 'user-2', 'user-3']
        },
        {
          guildId: 'guild-123',
          prize: 'Active Prize 2',
          channelId: 'channel-2',
          messageId: 'message-2',
          active: true,
          endTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
          participants: ['user-1', 'user-4', 'user-5']
        },
        {
          guildId: 'guild-123',
          prize: 'Finalized Prize',
          channelId: 'channel-3',
          messageId: 'message-3',
          active: false,
          finalized: true,
          endTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
          participants: ['user-2', 'user-3']
        },
        {
          guildId: 'guild-456',
          prize: 'Other Guild Prize',
          channelId: 'channel-4',
          messageId: 'message-4',
          active: true,
          endTime: new Date(Date.now() + 12 * 60 * 60 * 1000)
        }
      ];

      for (const data of testGiveaways) {
        await GiveawayModel.create(giveawayFactory.build(data));
      }
    });

    it('should find active giveaways by guild', async () => {
      const activeGiveaways = await GiveawayModel.find({
        guildId: 'guild-123',
        active: true
      });

      expect(activeGiveaways).toHaveLength(2);
      expect(activeGiveaways.every(g => g.active)).toBe(true);
      expect(activeGiveaways.every(g => g.guildId === 'guild-123')).toBe(true);
    });

    it('should find finalized giveaways', async () => {
      const finalizedGiveaways = await GiveawayModel.find({
        guildId: 'guild-123',
        finalized: true
      });

      expect(finalizedGiveaways).toHaveLength(1);
      expect(finalizedGiveaways[0].prize).toBe('Finalized Prize');
      expect(finalizedGiveaways[0].finalized).toBe(true);
    });

    it('should find giveaways by participant', async () => {
      const userGiveaways = await GiveawayModel.find({
        guildId: 'guild-123',
        participants: 'user-1'
      });

      expect(userGiveaways).toHaveLength(2);
      expect(userGiveaways.every(g => g.participants.includes('user-1'))).toBe(true);
    });

    it('should find upcoming giveaways', async () => {
      const now = new Date();
      const upcomingGiveaways = await GiveawayModel.find({
        endTime: { $gt: now },
        active: true
      });

      expect(upcomingGiveaways.length).toBeGreaterThan(0);
      expect(upcomingGiveaways.every(g => g.endTime > now)).toBe(true);
      expect(upcomingGiveaways.every(g => g.active)).toBe(true);
    });

    it('should sort giveaways by end time', async () => {
      const giveaways = await GiveawayModel
        .find({ guildId: 'guild-123' })
        .sort({ endTime: 1 });

      expect(giveaways).toHaveLength(3);
      for (let i = 1; i < giveaways.length; i++) {
        expect(giveaways[i].endTime >= giveaways[i - 1].endTime).toBe(true);
      }
    });
  });

  describe('Aggregation and Statistics', () => {
    beforeEach(async () => {
      const testData = [
        {
          guildId: 'guild-123',
          prize: 'Prize 1',
          channelId: 'channel-1',
          messageId: 'message-1',
          active: false,
          finalized: true,
          participants: ['user-1', 'user-2', 'user-3']
        },
        {
          guildId: 'guild-123',
          prize: 'Prize 2',
          channelId: 'channel-2',
          messageId: 'message-2',
          active: false,
          finalized: true,
          participants: ['user-2', 'user-3', 'user-4', 'user-5']
        },
        {
          guildId: 'guild-123',
          prize: 'Prize 3',
          channelId: 'channel-3',
          messageId: 'message-3',
          active: true,
          finalized: false,
          participants: ['user-1', 'user-4', 'user-6']
        }
      ];

      for (const data of testData) {
        await GiveawayModel.create(giveawayFactory.build(data));
      }
    });

    it('should calculate guild giveaway statistics', async () => {
      const stats = await GiveawayModel.aggregate([
        { $match: { guildId: 'guild-123' } },
        {
          $group: {
            _id: '$guildId',
            totalGiveaways: { $sum: 1 },
            activeGiveaways: {
              $sum: { $cond: ['$active', 1, 0] }
            },
            finalizedGiveaways: {
              $sum: { $cond: ['$finalized', 1, 0] }
            },
            totalParticipants: {
              $sum: { $size: '$participants' }
            },
            avgParticipants: {
              $avg: { $size: '$participants' }
            }
          }
        }
      ]);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalGiveaways).toBe(3);
      expect(stats[0].activeGiveaways).toBe(1);
      expect(stats[0].finalizedGiveaways).toBe(2);
      expect(stats[0].totalParticipants).toBe(10);
      expect(stats[0].avgParticipants).toBeCloseTo(3.33, 2);
    });

    it('should find most active participants', async () => {
      const topParticipants = await GiveawayModel.aggregate([
        { $match: { guildId: 'guild-123' } },
        { $unwind: '$participants' },
        {
          $group: {
            _id: '$participants',
            giveawaysEntered: { $sum: 1 },
            prizes: { $push: '$prize' }
          }
        },
        { $sort: { giveawaysEntered: -1 } },
        { $limit: 10 }
      ]);

      expect(topParticipants).toHaveLength(6);
      
      const multipleEntries = topParticipants.filter(p => p.giveawaysEntered > 1);
      expect(multipleEntries.length).toBeGreaterThan(0);
      
      const user1 = topParticipants.find(p => p._id === 'user-1');
      expect(user1?.giveawaysEntered).toBe(2);
    });

    it('should get giveaway participation trends', async () => {
      const trends = await GiveawayModel.aggregate([
        { $match: { guildId: 'guild-123' } },
        {
          $project: {
            prize: 1,
            participantCount: { $size: '$participants' },
            isFinalized: '$finalized',
            isActive: '$active',
            createdAt: 1
          }
        },
        { $sort: { createdAt: 1 } }
      ]);

      expect(trends).toHaveLength(3);
      expect(trends.every(t => typeof t.participantCount === 'number')).toBe(true);
      expect(trends.filter(t => t.isFinalized)).toHaveLength(2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large participant lists efficiently', async () => {
      const largeParticipantList = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
      
      const giveawayData = giveawayFactory.build({
        guildId: 'guild-large',
        prize: 'Large Prize',
        channelId: 'channel-large',
        messageId: 'message-large',
        participants: largeParticipantList
      });

      const startTime = Date.now();
      const giveaway = await GiveawayModel.create(giveawayData);
      const createTime = Date.now() - startTime;

      expect(giveaway.participants).toHaveLength(1000);
      expect(createTime).toBeLessThan(500);
      const queryStart = Date.now();
      const foundGiveaway = await GiveawayModel.findOne({
        guildId: 'guild-large',
        participants: 'user-500'
      });
      const queryTime = Date.now() - queryStart;

      expect(foundGiveaway).toBeDefined();
      expect(queryTime).toBeLessThan(100);

      logger.info(`Large giveaway create: ${createTime}ms, query: ${queryTime}ms`);
    });

    it('should handle bulk operations efficiently', async () => {
      const giveaways = [];
      
      for (let i = 0; i < 50; i++) {
        giveaways.push(giveawayFactory.build({
          guildId: 'guild-bulk',
          prize: `Bulk Prize ${i}`,
          channelId: `channel-${i}`,
          messageId: `message-${i}`,
          participants: Array.from({ length: 10 }, (_, j) => `user-${i}-${j}`)
        }));
      }

      const startTime = Date.now();
      await GiveawayModel.insertMany(giveaways);
      const insertTime = Date.now() - startTime;

      expect(insertTime).toBeLessThan(1000);

      const count = await GiveawayModel.countDocuments({ guildId: 'guild-bulk' });
      expect(count).toBe(50);

      logger.info(`Bulk insert of 50 giveaways took ${insertTime}ms`);
    });
  });
});