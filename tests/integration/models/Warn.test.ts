import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { WarnModel } from '../../../src/models/Warn';
import { warnFactory } from '../factories';
import { clearTestData } from '../helpers/seeding';
import logger from '../../../src/utils/logger';

describe('Warn Model Integration Tests', () => {
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
    it('should create a valid warn record with warnings array', async () => {
      const warnData = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [
          {
            reason: 'Inappropriate behavior in chat',
            moderatorId: 'moderator-123',
            date: new Date()
          }
        ]
      });

      const warn = await WarnModel.create(warnData);

      expect(warn).toBeDefined();
      expect(warn.guildId).toBe('guild-123');
      expect(warn.userId).toBe('user-123');
      expect(warn.warnings).toHaveLength(1);
      expect(warn.warnings[0].reason).toBe('Inappropriate behavior in chat');
      expect(warn.warnings[0].moderatorId).toBe('moderator-123');
      expect(warn.warnings[0].date).toBeInstanceOf(Date);
    });

    it('should require guildId field', async () => {
      const warnData = {
        userId: 'user-123',
        warnings: [{ reason: 'Test reason', moderatorId: 'mod-123', date: new Date() }]
      };

      await expect(WarnModel.create(warnData)).rejects.toThrow(/guildId.*required/);
    });

    it('should require userId field', async () => {
      const warnData = {
        guildId: 'guild-123',
        warnings: [{ reason: 'Test reason', moderatorId: 'mod-123', date: new Date() }]
      };

      await expect(WarnModel.create(warnData)).rejects.toThrow(/userId.*required/);
    });

    it('should require reason in warn entries', async () => {
      const warnData = {
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [
          {
            moderatorId: 'moderator-123',
            date: new Date()
          }
        ]
      };

      await expect(WarnModel.create(warnData)).rejects.toThrow(/reason.*required/);
    });

    it('should require moderator in warn entries', async () => {
      const warnData = {
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [
          {
            reason: 'Test reason',
            date: new Date()
          }
        ]
      };

      await expect(WarnModel.create(warnData)).rejects.toThrow(/moderator.*required/);
    });

    it('should set default date for warn entries', async () => {
      const beforeCreate = Date.now();
      const warnData = {
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [
          {
            reason: 'Test reason',
            moderatorId: 'moderator-123'
          }
        ]
      };

      const warn = await WarnModel.create(warnData);
      const afterCreate = Date.now();

      expect(warn.warnings[0].date).toBeInstanceOf(Date);
      expect(warn.warnings[0].date.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(warn.warnings[0].date.getTime()).toBeLessThanOrEqual(afterCreate);
    });

    it('should create user record with empty warnings array', async () => {
      const warnData = {
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: []
      };

      const warn = await WarnModel.create(warnData);

      expect(warn.warnings).toHaveLength(0);
      expect(warn.warnings).toEqual([]);
    });
  });

  describe('Unique Constraints and Indexes', () => {
    it('should allow multiple warn records for same userId + guildId combination', async () => {
      
      const warn1Data = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [{ reason: 'First warning', moderatorId: 'mod-1', date: new Date() }]
      });

      const warn1 = await WarnModel.create(warn1Data);
      const warn2Data = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [{ reason: 'Second warning', moderatorId: 'mod-2', date: new Date() }]
      });

      const warn2 = await WarnModel.create(warn2Data);

      expect(warn1).toBeDefined();
      expect(warn2).toBeDefined();
      expect(warn1._id).not.toEqual(warn2._id);
    });

    it('should allow same user in different guilds', async () => {
      const warn1Data = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [{ reason: 'Warning in guild 1', moderatorId: 'mod-1', date: new Date() }]
      });

      const warn2Data = warnFactory.build({
        guildId: 'guild-456',
        userId: 'user-123',
        warnings: [{ reason: 'Warning in guild 2', moderatorId: 'mod-2', date: new Date() }]
      });

      const warn1 = await WarnModel.create(warn1Data);
      const warn2 = await WarnModel.create(warn2Data);

      expect(warn1).toBeDefined();
      expect(warn2).toBeDefined();
      expect(warn1.guildId).toBe('guild-123');
      expect(warn2.guildId).toBe('guild-456');
    });

    it('should allow different users in same guild', async () => {
      const warn1Data = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [{ reason: 'Warning for user 1', moderatorId: 'mod-1', date: new Date() }]
      });

      const warn2Data = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-456',
        warnings: [{ reason: 'Warning for user 2', moderatorId: 'mod-2', date: new Date() }]
      });

      const warn1 = await WarnModel.create(warn1Data);
      const warn2 = await WarnModel.create(warn2Data);

      expect(warn1).toBeDefined();
      expect(warn2).toBeDefined();
      expect(warn1.userId).toBe('user-123');
      expect(warn2.userId).toBe('user-456');
    });
  });

  describe('Warning Management Operations', () => {
    it('should handle adding warnings to existing user record', async () => {
      const initialData = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [
          { reason: 'First warning', moderatorId: 'mod-1', date: new Date() }
        ]
      });

      const warn = await WarnModel.create(initialData);
      warn.warnings.push(
        { reason: 'Second warning', moderatorId: 'mod-2', date: new Date() },
        { reason: 'Third warning', moderatorId: 'mod-3', date: new Date() }
      );
      await warn.save();

      const updatedWarn = await WarnModel.findById(warn._id);
      expect(updatedWarn!.warnings).toHaveLength(3);
      expect(updatedWarn!.warnings[1].reason).toBe('Second warning');
      expect(updatedWarn!.warnings[2].reason).toBe('Third warning');
    });

    it('should handle removing specific warnings', async () => {
      const warnData = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [
          { reason: 'Warning 1', moderatorId: 'mod-1', date: new Date() },
          { reason: 'Warning 2', moderatorId: 'mod-2', date: new Date() },
          { reason: 'Warning 3', moderatorId: 'mod-3', date: new Date() }
        ]
      });

      const warn = await WarnModel.create(warnData);

      warn.warnings.splice(1, 1);
      await warn.save();

      const updatedWarn = await WarnModel.findById(warn._id);
      expect(updatedWarn!.warnings).toHaveLength(2);
      expect(updatedWarn!.warnings[0].reason).toBe('Warning 1');
      expect(updatedWarn!.warnings[1].reason).toBe('Warning 3');
    });

    it('should handle clearing all warnings', async () => {
      const warnData = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [
          { reason: 'Warning 1', moderatorId: 'mod-1', date: new Date() },
          { reason: 'Warning 2', moderatorId: 'mod-2', date: new Date() }
        ]
      });

      const warn = await WarnModel.create(warnData);
      warn.warnings = [];
      await warn.save();

      const clearedWarn = await WarnModel.findById(warn._id);
      expect(clearedWarn!.warnings).toHaveLength(0);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const testWarns = [
        {
          guildId: 'guild-123',
          userId: 'user-active',
          warnings: [
            { reason: 'Spam', moderatorId: 'mod-1', date: new Date() },
            { reason: 'Harassment', moderatorId: 'mod-2', date: new Date() }
          ]
        },
        {
          guildId: 'guild-123',
          userId: 'user-single',
          warnings: [
            { reason: 'Minor offense', moderatorId: 'mod-1', date: new Date() }
          ]
        },
        {
          guildId: 'guild-123',
          userId: 'user-clean',
          warnings: []
        },
        {
          guildId: 'guild-456',
          userId: 'user-other',
          warnings: [
            { reason: 'Other guild warning', moderatorId: 'mod-3', date: new Date() }
          ]
        }
      ];

      for (const data of testWarns) {
        await WarnModel.create(warnFactory.build(data));
      }
    });

    it('should find users with warnings in specific guild', async () => {
      const usersWithWarnings = await WarnModel.find({
        guildId: 'guild-123',
        'warnings.0': { $exists: true }
      });

      expect(usersWithWarnings).toHaveLength(2);
      expect(usersWithWarnings.map(w => w.userId)).toContain('user-active');
      expect(usersWithWarnings.map(w => w.userId)).toContain('user-single');
    });

    it('should find users with no warnings', async () => {
      const cleanUsers = await WarnModel.find({
        guildId: 'guild-123',
        warnings: { $size: 0 }
      });

      expect(cleanUsers).toHaveLength(1);
      expect(cleanUsers[0].userId).toBe('user-clean');
    });

    it('should find user by userId in specific guild', async () => {
      const userWarn = await WarnModel.findOne({
        guildId: 'guild-123',
        userId: 'user-active'
      });

      expect(userWarn).toBeDefined();
      expect(userWarn!.warnings).toHaveLength(2);
    });

    it('should find users warned by specific moderator', async () => {
      const mod1Warns = await WarnModel.find({
        guildId: 'guild-123',
        'warnings.moderatorId': 'mod-1'
      });

      expect(mod1Warns).toHaveLength(2);
    });

    it('should find warnings by reason pattern', async () => {
      const spamWarns = await WarnModel.find({
        guildId: 'guild-123',
        'warnings.reason': { $regex: /spam/i }
      });

      expect(spamWarns).toHaveLength(1);
      expect(spamWarns[0].userId).toBe('user-active');
    });

    it('should count total warnings in guild', async () => {
      const guildWarns = await WarnModel.aggregate([
        { $match: { guildId: 'guild-123' } },
        { $unwind: '$warnings' },
        { $count: 'totalWarnings' }
      ]);

      expect(guildWarns[0].totalWarnings).toBe(3);
    });
  });

  describe('Aggregation and Statistics', () => {
    beforeEach(async () => {
      const testData = [
        {
          guildId: 'guild-stats',
          userId: 'user-1',
          warnings: [
            { reason: 'Spam', moderatorId: 'mod-1', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
            { reason: 'Harassment', moderatorId: 'mod-2', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
          ]
        },
        {
          guildId: 'guild-stats',
          userId: 'user-2',
          warnings: [
            { reason: 'NSFW content', moderatorId: 'mod-1', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
          ]
        },
        {
          guildId: 'guild-stats',
          userId: 'user-3',
          warnings: []
        },
        {
          guildId: 'guild-stats',
          userId: 'user-4',
          warnings: [
            { reason: 'Spam', moderatorId: 'mod-3', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
            { reason: 'Toxicity', moderatorId: 'mod-1', date: new Date() },
            { reason: 'Rule violation', moderatorId: 'mod-2', date: new Date() }
          ]
        }
      ];

      for (const data of testData) {
        await WarnModel.create(warnFactory.build(data));
      }
    });

    it('should calculate guild warning statistics', async () => {
      const stats = await WarnModel.aggregate([
        { $match: { guildId: 'guild-stats' } },
        {
          $project: {
            userId: 1,
            warningCount: { $size: '$warnings' },
            hasWarnings: { $gt: [{ $size: '$warnings' }, 0] }
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            usersWithWarnings: { $sum: { $cond: ['$hasWarnings', 1, 0] } },
            cleanUsers: { $sum: { $cond: ['$hasWarnings', 0, 1] } },
            totalWarnings: { $sum: '$warningCount' },
            maxWarningsPerUser: { $max: '$warningCount' },
            avgWarningsPerUser: { $avg: '$warningCount' }
          }
        }
      ]);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalUsers).toBe(4);
      expect(stats[0].usersWithWarnings).toBe(3);
      expect(stats[0].cleanUsers).toBe(1);
      expect(stats[0].totalWarnings).toBe(6);
      expect(stats[0].maxWarningsPerUser).toBe(3);
      expect(stats[0].avgWarningsPerUser).toBe(1.5);
    });

    it('should find most warned users', async () => {
      const topWarned = await WarnModel.aggregate([
        { $match: { guildId: 'guild-stats' } },
        {
          $project: {
            userId: 1,
            warningCount: { $size: '$warnings' },
            reasons: '$warnings.reason',
            moderators: '$warnings.moderatorId'
          }
        },
        { $match: { warningCount: { $gt: 0 } } },
        { $sort: { warningCount: -1 } },
        { $limit: 3 }
      ]);

      expect(topWarned).toHaveLength(3);
      expect(topWarned[0].userId).toBe('user-4');
      expect(topWarned[0].warningCount).toBe(3);
    });

    it('should calculate moderator activity', async () => {
      const modStats = await WarnModel.aggregate([
        { $match: { guildId: 'guild-stats' } },
        { $unwind: '$warnings' },
        {
          $group: {
            _id: '$warnings.moderatorId',
            warningsIssued: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            reasons: { $push: '$warnings.reason' }
          }
        },
        { $sort: { warningsIssued: -1 } }
      ]);

      expect(modStats).toHaveLength(3);
      
      const topMod = modStats.find(m => m._id === 'mod-1');
      expect(topMod?.warningsIssued).toBe(3);
      expect(topMod?.uniqueUsers).toHaveLength(3);
    });

    it('should find most common warning reasons', async () => {
      const reasonStats = await WarnModel.aggregate([
        { $match: { guildId: 'guild-stats' } },
        { $unwind: '$warnings' },
        {
          $group: {
            _id: '$warnings.reason',
            count: { $sum: 1 },
            moderators: { $addToSet: '$warnings.moderatorId' },
            users: { $addToSet: '$userId' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      expect(reasonStats.length).toBeGreaterThan(0);
      
      const spamReason = reasonStats.find(r => r._id === 'Spam');
      expect(spamReason?.count).toBe(2);
    });

    it('should analyze warning trends over time', async () => {
      const timeStats = await WarnModel.aggregate([
        { $match: { guildId: 'guild-stats' } },
        { $unwind: '$warnings' },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$warnings.date' }
            },
            warningsPerDay: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            moderators: { $addToSet: '$warnings.moderatorId' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      expect(timeStats.length).toBeGreaterThan(0);
      expect(timeStats.every(t => t.warningsPerDay > 0)).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of users with warnings efficiently', async () => {
      const warns = [];
      const userCount = 100;
      
      for (let userId = 0; userId < userCount; userId++) {
        const warningCount = Math.floor(Math.random() * 5) + 1;
        const warnings = [];
        
        for (let warnNum = 0; warnNum < warningCount; warnNum++) {
          warnings.push({
            reason: `Warning ${warnNum + 1} for user ${userId}`,
            moderatorId: `mod-${userId % 10}`,
            date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
          });
        }

        warns.push(warnFactory.build({
          guildId: 'guild-performance',
          userId: `user-${userId}`,
          warnings
        }));
      }

      const insertStart = Date.now();
      await WarnModel.insertMany(warns);
      const insertTime = Date.now() - insertStart;

      expect(insertTime).toBeLessThan(3000);
      const queryStart = Date.now();
      const usersWithMultipleWarnings = await WarnModel.find({
        guildId: 'guild-performance',
        'warnings.1': { $exists: true }
      });
      const queryTime = Date.now() - queryStart;

      expect(usersWithMultipleWarnings.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(500);

      logger.info(`Performance test: insert ${insertTime}ms, query ${queryTime}ms`);
    });

    it('should handle concurrent warning additions efficiently', async () => {
      const userId = 'user-concurrent';
      const guildId = 'guild-concurrent';
      const initialWarn = await WarnModel.create({
        guildId,
        userId,
        warnings: []
      });

      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          WarnModel.findOneAndUpdate(
            { guildId, userId },
            {
              $push: {
                warnings: {
                  reason: `Concurrent warning ${i}`,
                  moderatorId: `mod-${i}`,
                  date: new Date()
                }
              }
            },
            { new: true }
          )
        );
      }

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r !== null)).toBe(true);
      const finalWarn = await WarnModel.findOne({ guildId, userId });
      expect(finalWarn!.warnings.length).toBeGreaterThan(0);
      expect(finalWarn!.warnings.length).toBeLessThanOrEqual(10);

      logger.info(`Concurrent operations completed, final warning count: ${finalWarn!.warnings.length}`);
    });

    it('should handle bulk warning operations efficiently', async () => {
      const warns = [];
      for (let i = 0; i < 50; i++) {
        warns.push(warnFactory.build({
          guildId: 'guild-bulk',
          userId: `user-${i}`,
          warnings: [
            { reason: 'Initial warning', moderatorId: 'mod-bulk', date: new Date() }
          ]
        }));
      }

      await WarnModel.insertMany(warns);

      const updateStart = Date.now();
      await WarnModel.updateMany(
        { guildId: 'guild-bulk' },
        {
          $push: {
            warnings: {
              reason: 'Bulk added warning',
              moderatorId: 'mod-bulk-update',
              date: new Date()
            }
          }
        }
      );
      const updateTime = Date.now() - updateStart;

      expect(updateTime).toBeLessThan(1000);
      const updatedWarns = await WarnModel.find({ guildId: 'guild-bulk' });
      expect(updatedWarns).toHaveLength(50);
      expect(updatedWarns.every(w => w.warnings.length === 2)).toBe(true);

      logger.info(`Bulk update took ${updateTime}ms`);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long warning reasons', async () => {
      const longReason = 'A'.repeat(2000);
      
      const warnData = warnFactory.build({
        guildId: 'guild-123',
        userId: 'user-123',
        warnings: [
          { reason: longReason, moderatorId: 'mod-123', date: new Date() }
        ]
      });

      const warn = await WarnModel.create(warnData);
      expect(warn.warnings[0].reason).toBe(longReason);
    });

    it('should handle special characters in reasons and moderator IDs', async () => {
      const specialReason = 'Warning with "special" characters: @#$%^&*()_+-=[]{}|;:,.<>?';
      const specialModId = 'mod-special_123.test@example';
      
      const warnData = warnFactory.build({
        guildId: 'guild-special',
        userId: 'user-special',
        warnings: [
          { reason: specialReason, moderatorId: specialModId, date: new Date() }
        ]
      });

      const warn = await WarnModel.create(warnData);
      expect(warn.warnings[0].reason).toBe(specialReason);
      expect(warn.warnings[0].moderatorId).toBe(specialModId);
    });

    it('should handle deletion of user warn records', async () => {
      const warnData = warnFactory.build({
        guildId: 'guild-delete',
        userId: 'user-delete',
        warnings: [
          { reason: 'Warning to be deleted', moderatorId: 'mod-delete', date: new Date() }
        ]
      });

      const warn = await WarnModel.create(warnData);
      const warnId = warn._id;

      await WarnModel.findByIdAndDelete(warnId);
      const deletedWarn = await WarnModel.findById(warnId);
      expect(deletedWarn).toBeNull();
    });

    it('should handle maximum array size limitations gracefully', async () => {
      const warnData = warnFactory.build({
        guildId: 'guild-max',
        userId: 'user-max',
        warnings: []
      });

      const warn = await WarnModel.create(warnData);
      const warnings = [];
      for (let i = 0; i < 1000; i++) {
        warnings.push({
          reason: `Mass warning ${i}`,
          moderatorId: `mod-${i % 10}`,
          date: new Date()
        });
      }

      warn.warnings = warnings;
      
      try {
        await warn.save();
        expect(warn.warnings).toHaveLength(1000);
      } catch (error) {
        expect((error as Error).message).toMatch(/document.*size|limit/i);
      }
    });
  });
});
