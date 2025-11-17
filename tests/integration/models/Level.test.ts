import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { LevelModel } from '../../../src/models/Level';
import { LevelConfigModel } from '../../../src/models/LevelConfig';
import { levelFactory } from '../factories';
import { clearTestData } from '../helpers/seeding';
import logger from '../../../src/utils/logger';

describe('Level Model Integration Tests', () => {
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
    it('should create a valid level record', async () => {
      const levelData = levelFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 5,
        xp: 500
      });

      const level = await LevelModel.create(levelData);

      expect(level).toBeDefined();
      expect(level.guildId).toBe('guild-123');
      expect(level.userId).toBe('user-123');
      expect(level.level).toBe(5);
      expect(level.xp).toBe(500);
      expect(level.lastMessageTs).toBeInstanceOf(Date);
      expect(level.lastVcUpdateTs).toBeInstanceOf(Date);
    });

    it('should require guildId field', async () => {
      const levelData = {
        userId: 'user-123',
        level: 1,
        xp: 0
      };

      await expect(LevelModel.create(levelData)).rejects.toThrow(/guildId.*required/);
    });

    it('should require userId field', async () => {
      const levelData = {
        guildId: 'guild-123',
        level: 1,
        xp: 0
      };

      await expect(LevelModel.create(levelData)).rejects.toThrow(/userId.*required/);
    });

    it('should set default values correctly', async () => {
      const levelData = {
        guildId: 'guild-123',
        userId: 'user-123'
      };

      const level = await LevelModel.create(levelData);

      expect(level.level).toBe(1);
      expect(level.xp).toBe(0);
    });

    it('should validate minimum values', async () => {
      await expect(LevelModel.create({
        guildId: 'guild-123',
        userId: 'user-123',
        xp: -1
      })).rejects.toThrow();
      await expect(LevelModel.create({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 0
      })).rejects.toThrow();
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique constraint on guildId + userId', async () => {
      const levelData = levelFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 5,
        xp: 500
      });

      await LevelModel.create(levelData);

      const duplicateData = levelFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 10,
        xp: 1000
      });

      await expect(LevelModel.create(duplicateData)).rejects.toThrow(/duplicate key/);
    });

    it('should allow same user in different guilds', async () => {
      const level1Data = levelFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 5,
        xp: 500
      });

      const level2Data = levelFactory.build({
        guildId: 'guild-456',
        userId: 'user-123',
        level: 10,
        xp: 1000
      });

      const level1 = await LevelModel.create(level1Data);
      const level2 = await LevelModel.create(level2Data);

      expect(level1).toBeDefined();
      expect(level2).toBeDefined();
      expect(level1.guildId).toBe('guild-123');
      expect(level2.guildId).toBe('guild-456');
    });

    it('should allow different users in same guild', async () => {
      const level1Data = levelFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 5,
        xp: 500
      });

      const level2Data = levelFactory.build({
        guildId: 'guild-123',
        userId: 'user-456',
        level: 8,
        xp: 800
      });

      const level1 = await LevelModel.create(level1Data);
      const level2 = await LevelModel.create(level2Data);

      expect(level1).toBeDefined();
      expect(level2).toBeDefined();
      expect(level1.userId).toBe('user-123');
      expect(level2.userId).toBe('user-456');
    });
  });

  describe('Level Progression Operations', () => {
    it('should handle XP updates', async () => {
      const levelData = levelFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 5,
        xp: 500
      });

      const level = await LevelModel.create(levelData);
      level.xp = 750;
      level.level = 6;
      await level.save();

      const updatedLevel = await LevelModel.findById(level._id);
      expect(updatedLevel!.xp).toBe(750);
      expect(updatedLevel!.level).toBe(6);
    });

    it('should update timestamps correctly', async () => {
      const level = await LevelModel.create({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 1,
        xp: 0,
        lastMessageTs: new Date('2023-01-01'),
        lastVcUpdateTs: new Date('2023-01-01')
      });

      const originalMessageTs = level.lastMessageTs;
      const originalVcTs = level.lastVcUpdateTs;
      await new Promise(resolve => setTimeout(resolve, 10));

      level.lastMessageTs = new Date();
      level.lastVcUpdateTs = new Date();
      await level.save();

      const updatedLevel = await LevelModel.findById(level._id);
      expect(updatedLevel!.lastMessageTs!.getTime()).toBeGreaterThan(originalMessageTs!.getTime());
      expect(updatedLevel!.lastVcUpdateTs!.getTime()).toBeGreaterThan(originalVcTs!.getTime());
    });

    it('should handle bulk XP additions', async () => {
      const guildId = 'guild-bulk';
      const userIds = ['user-1', 'user-2', 'user-3'];
      for (const userId of userIds) {
        await LevelModel.create({
          guildId,
          userId,
          level: 1,
          xp: 100
        });
      }

      await LevelModel.updateMany(
        { guildId },
        { $inc: { xp: 50 } }
      );

      const updatedLevels = await LevelModel.find({ guildId });
      expect(updatedLevels).toHaveLength(3);
      expect(updatedLevels.every(l => l.xp === 150)).toBe(true);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const testLevels = [
        { guildId: 'guild-123', userId: 'user-1', level: 10, xp: 50 },
        { guildId: 'guild-123', userId: 'user-2', level: 15, xp: 200 },
        { guildId: 'guild-123', userId: 'user-3', level: 8, xp: 750 },
        { guildId: 'guild-123', userId: 'user-4', level: 20, xp: 100 },
        { guildId: 'guild-456', userId: 'user-1', level: 5, xp: 300 }
      ];

      for (const data of testLevels) {
        await LevelModel.create(levelFactory.build(data));
      }
    });

    it('should find levels by guild', async () => {
      const guildLevels = await LevelModel.find({ guildId: 'guild-123' });

      expect(guildLevels).toHaveLength(4);
      expect(guildLevels.every(l => l.guildId === 'guild-123')).toBe(true);
    });

    it('should sort levels by level descending', async () => {
      const levels = await LevelModel
        .find({ guildId: 'guild-123' })
        .sort({ level: -1 });

      expect(levels).toHaveLength(4);
      expect(levels[0].userId).toBe('user-4');
      expect(levels[0].level).toBe(20);
      expect(levels[3].userId).toBe('user-3');
      expect(levels[3].level).toBe(8);
    });

    it('should find user level in specific guild', async () => {
      const userLevel = await LevelModel.findOne({
        guildId: 'guild-123',
        userId: 'user-2'
      });

      expect(userLevel).toBeDefined();
      expect(userLevel!.level).toBe(15);
      expect(userLevel!.xp).toBe(200);
    });

    it('should find levels above certain threshold', async () => {
      const userLevel = await LevelModel.findOne({
        guildId: 'guild-123',
        userId: 'user-2'
      });

      const higherLevels = await LevelModel.find({
        guildId: 'guild-123',
        level: { $gt: userLevel!.level }
      });

      expect(higherLevels).toHaveLength(1);
      expect(higherLevels[0].userId).toBe('user-4');
    });

    it('should find top levels in guild', async () => {
      const topLevels = await LevelModel
        .find({ guildId: 'guild-123' })
        .sort({ level: -1 })
        .limit(2);

      expect(topLevels).toHaveLength(2);
      expect(topLevels[0].userId).toBe('user-4');
      expect(topLevels[1].userId).toBe('user-2');
    });
  });

  describe('Aggregation and Statistics', () => {
    beforeEach(async () => {
      const testData = [
        { guildId: 'guild-123', userId: 'user-1', level: 10, xp: 50 },
        { guildId: 'guild-123', userId: 'user-2', level: 15, xp: 200 },
        { guildId: 'guild-123', userId: 'user-3', level: 8, xp: 750 },
        { guildId: 'guild-123', userId: 'user-4', level: 20, xp: 100 },
        { guildId: 'guild-456', userId: 'user-1', level: 5, xp: 300 }
      ];

      for (const data of testData) {
        await LevelModel.create(levelFactory.build(data));
      }
    });

    it('should calculate guild level statistics', async () => {
      const stats = await LevelModel.aggregate([
        { $match: { guildId: 'guild-123' } },
        {
          $group: {
            _id: '$guildId',
            userCount: { $sum: 1 },
            avgLevel: { $avg: '$level' },
            maxLevel: { $max: '$level' },
            minLevel: { $min: '$level' },
            totalXp: { $sum: '$xp' }
          }
        }
      ]);

      expect(stats).toHaveLength(1);
      expect(stats[0].userCount).toBe(4);
      expect(stats[0].avgLevel).toBe(13.25);
      expect(stats[0].maxLevel).toBe(20);
      expect(stats[0].minLevel).toBe(8);
      expect(stats[0].totalXp).toBe(1100);
    });

    it('should find level distribution', async () => {
      const distribution = await LevelModel.aggregate([
        { $match: { guildId: 'guild-123' } },
        {
          $bucket: {
            groupBy: '$level',
            boundaries: [0, 10, 15, 20, 25],
            default: '25+',
            output: {
              count: { $sum: 1 },
              users: { $push: '$userId' }
            }
          }
        }
      ]);

      expect(distribution.length).toBeGreaterThan(0);
    });

    it('should rank users by level', async () => {
      const rankings = await LevelModel.aggregate([
        { $match: { guildId: 'guild-123' } },
        { $sort: { level: -1, xp: -1 } },
        {
          $project: {
            userId: 1,
            level: 1,
            xp: 1,
            rank: { $literal: 1 }
          }
        },
        {
          $group: {
            _id: '$guildId',
            rankings: {
              $push: {
                userId: '$userId',
                level: '$level',
                xp: '$xp'
              }
            }
          }
        }
      ]);

      expect(rankings).toHaveLength(1);
      expect(rankings[0].rankings).toHaveLength(4);
    });
  });

  describe('Level Configuration Integration', () => {
    it('should work with LevelConfig', async () => {
      const config = await LevelConfigModel.create({
        guildId: 'guild-config',
        xpPerMsg: 10,
        xpPerMinVc: 5,
        cooldownSec: 30
      });

      expect(config).toBeDefined();
      expect(config.xpPerMsg).toBe(10);
      expect(config.xpPerMinVc).toBe(5);
      expect(config.cooldownSec).toBe(30);
      const level = await LevelModel.create({
        guildId: 'guild-config',
        userId: 'user-123',
        level: 1,
        xp: 0
      });

      expect(level.guildId).toBe(config.guildId);
    });

    it('should handle role rewards configuration', async () => {
      const config = await LevelConfigModel.create({
        guildId: 'guild-rewards',
        roleRewards: [
          { level: 5, roleId: 'role-123', rewardMessage: 'Congrats on level 5!' },
          { level: 10, roleId: 'role-456', rewardMessage: 'Amazing level 10!' }
        ]
      });

      expect(config.roleRewards).toHaveLength(2);
      expect(config.roleRewards[0].level).toBe(5);
      expect(config.roleRewards[1].level).toBe(10);
      const level1 = await LevelModel.create({
        guildId: 'guild-rewards',
        userId: 'user-1',
        level: 5,
        xp: 0
      });

      const level2 = await LevelModel.create({
        guildId: 'guild-rewards',
        userId: 'user-2',
        level: 10,
        xp: 0
      });

      expect(level1.level).toBe(config.roleRewards[0].level);
      expect(level2.level).toBe(config.roleRewards[1].level);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of level records efficiently', async () => {
      const levels = [];
      const userCount = 100;
      
      for (let i = 0; i < userCount; i++) {
        levels.push(levelFactory.build({
          guildId: 'guild-performance',
          userId: `user-${i}`,
          level: Math.floor(Math.random() * 50) + 1,
          xp: Math.floor(Math.random() * 1000)
        }));
      }

      const insertStart = Date.now();
      await LevelModel.insertMany(levels);
      const insertTime = Date.now() - insertStart;

      expect(insertTime).toBeLessThan(2000);
      const queryStart = Date.now();
      const topLevels = await LevelModel
        .find({ guildId: 'guild-performance' })
        .sort({ level: -1 })
        .limit(10);
      const queryTime = Date.now() - queryStart;

      expect(topLevels).toHaveLength(10);
      expect(queryTime).toBeLessThan(500);

      logger.info(`Performance test: insert ${insertTime}ms, query ${queryTime}ms`);
    });

    it('should handle concurrent XP updates efficiently', async () => {
      const level = await LevelModel.create({
        guildId: 'guild-concurrent',
        userId: 'user-concurrent',
        level: 1,
        xp: 0
      });

      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          LevelModel.findByIdAndUpdate(
            level._id,
            { $inc: { xp: 10 } },
            { new: true }
          )
        );
      }

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r !== null)).toBe(true);
      const finalLevel = await LevelModel.findById(level._id);
      expect(finalLevel!.xp).toBeGreaterThan(0);
      expect(finalLevel!.xp).toBeLessThanOrEqual(100);

      logger.info(`Concurrent operations completed, final XP: ${finalLevel!.xp}`);
    });

    it('should handle leaderboard queries efficiently', async () => {
      const levels = [];
      for (let i = 0; i < 50; i++) {
        levels.push(levelFactory.build({
          guildId: 'guild-leaderboard',
          userId: `user-${i}`,
          level: Math.floor(Math.random() * 30) + 1,
          xp: Math.floor(Math.random() * 1000)
        }));
      }

      await LevelModel.insertMany(levels);
      const queryStart = Date.now();
      const leaderboard = await LevelModel
        .find({ guildId: 'guild-leaderboard' })
        .sort({ level: -1, xp: -1 })
        .limit(20);
      const queryTime = Date.now() - queryStart;

      expect(leaderboard).toHaveLength(20);
      expect(queryTime).toBeLessThan(500);

      logger.info(`Leaderboard query took ${queryTime}ms`);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very high level values', async () => {
      const level = await LevelModel.create({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 9999,
        xp: 999999
      });

      expect(level.level).toBe(9999);
      expect(level.xp).toBe(999999);
    });

    it('should handle timestamp edge cases', async () => {
      const level = await LevelModel.create({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 1,
        xp: 0,
        lastMessageTs: undefined,
        lastVcUpdateTs: undefined
      });

      expect(level.lastMessageTs).toBeUndefined();
      expect(level.lastVcUpdateTs).toBeUndefined();
    });

    it('should handle deletion of level records', async () => {
      const level = await LevelModel.create({
        guildId: 'guild-123',
        userId: 'user-123',
        level: 5,
        xp: 500
      });

      const levelId = level._id;

      await LevelModel.findByIdAndDelete(levelId);
      const deletedLevel = await LevelModel.findById(levelId);
      expect(deletedLevel).toBeNull();
    });

    it('should handle special character user/guild IDs', async () => {
      const level = await LevelModel.create({
        guildId: 'guild_special-123.test',
        userId: 'user@special#456',
        level: 1,
        xp: 0
      });

      expect(level.guildId).toBe('guild_special-123.test');
      expect(level.userId).toBe('user@special#456');
    });
  });
});