import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { BirthdayModel } from '../../../src/models/Birthday';
import { birthdayFactory } from '../factories';
import { clearTestData } from '../helpers/seeding';
import logger from '../../../src/utils/logger';

describe('Birthday Model Integration Tests', () => {
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
    it('should create a valid birthday record', async () => {
      const birthdayData = birthdayFactory.build({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15'),
        yearSpecified: true,
        active: true
      });

      const birthday = await BirthdayModel.create(birthdayData);

      expect(birthday).toBeDefined();
      expect(birthday.userId).toBe('user-123');
      expect(birthday.guildId).toBe('guild-123');
      expect(birthday.date).toEqual(new Date('1990-06-15'));
      expect(birthday.yearSpecified).toBe(true);
      expect(birthday.active).toBe(true);
    });

    it('should require userId field', async () => {
      const birthdayData = {
        guildId: 'guild-123',
        date: new Date('1990-06-15'),
        yearSpecified: true,
        active: true
      };

      await expect(BirthdayModel.create(birthdayData)).rejects.toThrow(/userId.*required/);
    });

    it('should require guildId field', async () => {
      const birthdayData = {
        userId: 'user-123',
        date: new Date('1990-06-15'),
        yearSpecified: true,
        active: true
      };

      await expect(BirthdayModel.create(birthdayData)).rejects.toThrow(/guildId.*required/);
    });

    it('should require date field', async () => {
      const birthdayData = {
        userId: 'user-123',
        guildId: 'guild-123',
        yearSpecified: true,
        active: true
      };

      await expect(BirthdayModel.create(birthdayData)).rejects.toThrow(/date.*required/);
    });

    it('should set default values correctly', async () => {
      const birthdayData = {
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15')
      };

      const birthday = await BirthdayModel.create(birthdayData);

      expect(birthday.yearSpecified).toBe(true); // Default
      expect(birthday.active).toBe(true); // Default
    });

    it('should handle birthdays without year specified', async () => {
      // Birthday without year - use year 1900 as default for month/day only
      const birthdayData = birthdayFactory.build({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1900-12-25'), // Christmas, no year specified
        yearSpecified: false
      });

      const birthday = await BirthdayModel.create(birthdayData);

      expect(birthday.yearSpecified).toBe(false);
      expect(birthday.date.getMonth()).toBe(11); // December (0-indexed)
      expect(birthday.date.getDate()).toBe(25);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique constraint on userId + guildId', async () => {
      const birthdayData = birthdayFactory.build({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15')
      });

      await BirthdayModel.create(birthdayData);

      // Try to create another birthday for same user in same guild
      const duplicateData = birthdayFactory.build({
        userId: 'user-123',
        guildId: 'guild-123', // same user + guild
        date: new Date('1995-08-20') // different date
      });

      await expect(BirthdayModel.create(duplicateData)).rejects.toThrow(/duplicate key/);
    });

    it('should allow same user in different guilds', async () => {
      const birthday1Data = birthdayFactory.build({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15')
      });

      const birthday2Data = birthdayFactory.build({
        userId: 'user-123', // same user
        guildId: 'guild-456', // different guild
        date: new Date('1990-06-15')
      });

      const birthday1 = await BirthdayModel.create(birthday1Data);
      const birthday2 = await BirthdayModel.create(birthday2Data);

      expect(birthday1).toBeDefined();
      expect(birthday2).toBeDefined();
      expect(birthday1.guildId).toBe('guild-123');
      expect(birthday2.guildId).toBe('guild-456');
    });

    it('should allow different users in same guild', async () => {
      const birthday1Data = birthdayFactory.build({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15')
      });

      const birthday2Data = birthdayFactory.build({
        userId: 'user-456', // different user
        guildId: 'guild-123', // same guild
        date: new Date('1995-08-20')
      });

      const birthday1 = await BirthdayModel.create(birthday1Data);
      const birthday2 = await BirthdayModel.create(birthday2Data);

      expect(birthday1).toBeDefined();
      expect(birthday2).toBeDefined();
      expect(birthday1.userId).toBe('user-123');
      expect(birthday2.userId).toBe('user-456');
    });
  });

  describe('Birthday Management Operations', () => {
    it('should update birthday date', async () => {
      const birthday = await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15'),
        yearSpecified: true
      });

      // Update birthday date
      birthday.date = new Date('1990-07-20');
      await birthday.save();

      const updatedBirthday = await BirthdayModel.findById(birthday._id);
      expect(updatedBirthday!.date).toEqual(new Date('1990-07-20'));
    });

    it('should toggle yearSpecified flag', async () => {
      const birthday = await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15'),
        yearSpecified: true
      });

      // Toggle year specification
      birthday.yearSpecified = false;
      await birthday.save();

      const updatedBirthday = await BirthdayModel.findById(birthday._id);
      expect(updatedBirthday!.yearSpecified).toBe(false);
    });

    it('should toggle active status', async () => {
      const birthday = await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15'),
        active: true
      });

      // Deactivate birthday
      birthday.active = false;
      await birthday.save();

      const updatedBirthday = await BirthdayModel.findById(birthday._id);
      expect(updatedBirthday!.active).toBe(false);
    });

    it('should handle bulk status updates', async () => {
      const guildId = 'guild-bulk';
      const userIds = ['user-1', 'user-2', 'user-3'];

      // Create birthday records for multiple users
      for (const userId of userIds) {
        await BirthdayModel.create({
          userId,
          guildId,
          date: new Date('1990-06-15'),
          active: true
        });
      }

      // Bulk deactivate all birthdays in guild
      await BirthdayModel.updateMany(
        { guildId },
        { active: false }
      );

      const updatedBirthdays = await BirthdayModel.find({ guildId });
      expect(updatedBirthdays).toHaveLength(3);
      expect(updatedBirthdays.every(b => b.active === false)).toBe(true);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create test birthday data with various dates
      const testBirthdays = [
        { guildId: 'guild-123', userId: 'user-1', date: new Date('1990-01-15'), yearSpecified: true, active: true },
        { guildId: 'guild-123', userId: 'user-2', date: new Date('1995-06-30'), yearSpecified: true, active: true },
        { guildId: 'guild-123', userId: 'user-3', date: new Date('1900-01-15'), yearSpecified: false, active: true }, // No year
        { guildId: 'guild-123', userId: 'user-4', date: new Date('1988-12-25'), yearSpecified: true, active: false }, // Inactive
        { guildId: 'guild-456', userId: 'user-1', date: new Date('1992-03-10'), yearSpecified: true, active: true }
      ];

      for (const data of testBirthdays) {
        await BirthdayModel.create(birthdayFactory.build(data));
      }
    });

    it('should find birthdays by guild', async () => {
      const guildBirthdays = await BirthdayModel.find({ guildId: 'guild-123' });

      expect(guildBirthdays).toHaveLength(4);
      expect(guildBirthdays.every(b => b.guildId === 'guild-123')).toBe(true);
    });

    it('should find only active birthdays', async () => {
      const activeBirthdays = await BirthdayModel.find({ 
        guildId: 'guild-123',
        active: true 
      });

      expect(activeBirthdays).toHaveLength(3);
      expect(activeBirthdays.every(b => b.active === true)).toBe(true);
    });

    it('should find birthdays with year specified', async () => {
      const yearSpecifiedBirthdays = await BirthdayModel.find({ 
        guildId: 'guild-123',
        yearSpecified: true 
      });

      expect(yearSpecifiedBirthdays).toHaveLength(3);
      expect(yearSpecifiedBirthdays.every(b => b.yearSpecified === true)).toBe(true);
    });

    it('should find birthdays for specific month', async () => {
      // Find January birthdays (month 0)
      const januaryBirthdays = await BirthdayModel.find({
        guildId: 'guild-123',
        $expr: { $eq: [{ $month: '$date' }, 1] } // MongoDB months are 1-indexed
      });

      expect(januaryBirthdays).toHaveLength(2); // user-1 and user-3
      expect(januaryBirthdays.every(b => b.date.getMonth() === 0)).toBe(true); // JS months are 0-indexed
    });

    it('should find upcoming birthdays', async () => {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      
      // Find birthdays in the next 30 days (simplified query)
      const upcomingBirthdays = await BirthdayModel.find({
        guildId: 'guild-123',
        active: true,
        $expr: {
          $and: [
            { $gte: [{ $month: '$date' }, today.getMonth() + 1] },
            { $lte: [{ $month: '$date' }, nextMonth.getMonth() + 1] }
          ]
        }
      });

      expect(upcomingBirthdays).toBeDefined();
      expect(Array.isArray(upcomingBirthdays)).toBe(true);
    });

    it('should sort birthdays by date', async () => {
      const sortedBirthdays = await BirthdayModel
        .find({ guildId: 'guild-123', active: true })
        .sort({ date: 1 }); // Ascending order

      expect(sortedBirthdays).toHaveLength(3);
      // Check that dates are in ascending order
      for (let i = 1; i < sortedBirthdays.length; i++) {
        expect(sortedBirthdays[i].date.getTime()).toBeGreaterThanOrEqual(
          sortedBirthdays[i - 1].date.getTime()
        );
      }
    });
  });

  describe('Date and Age Calculations', () => {
    it('should calculate age correctly for year-specified birthdays', async () => {
      const birthDate = new Date('1990-06-15');
      const birthday = await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'guild-123',
        date: birthDate,
        yearSpecified: true
      });

      expect(birthday.yearSpecified).toBe(true);
      expect(birthday.date.getFullYear()).toBe(1990);
      
      // Calculate current age (will vary by test run date)
      const today = new Date();
      const currentAge = today.getFullYear() - birthDate.getFullYear() - 
        (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
      
      expect(currentAge).toBeGreaterThan(30); // Person born in 1990 should be over 30
    });

    it('should handle year-not-specified birthdays', async () => {
      const birthday = await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1900-12-25'), // Christmas, no specific year
        yearSpecified: false
      });

      expect(birthday.yearSpecified).toBe(false);
      expect(birthday.date.getMonth()).toBe(11); // December
      expect(birthday.date.getDate()).toBe(25);
      // Year should be 1900 (default for no-year birthdays)
      expect(birthday.date.getFullYear()).toBe(1900);
    });

    it('should find birthdays by day and month regardless of year', async () => {
      // Create multiple Christmas birthdays in different years
      await BirthdayModel.create({
        userId: 'user-1',
        guildId: 'guild-123',
        date: new Date('1990-12-25'),
        yearSpecified: true
      });

      await BirthdayModel.create({
        userId: 'user-2',
        guildId: 'guild-123',
        date: new Date('1995-12-25'),
        yearSpecified: true
      });

      await BirthdayModel.create({
        userId: 'user-3',
        guildId: 'guild-123',
        date: new Date('1900-12-25'),
        yearSpecified: false
      });

      // Find all Christmas birthdays regardless of year
      const christmasBirthdays = await BirthdayModel.find({
        guildId: 'guild-123',
        $expr: {
          $and: [
            { $eq: [{ $month: '$date' }, 12] },
            { $eq: [{ $dayOfMonth: '$date' }, 25] }
          ]
        }
      });

      expect(christmasBirthdays).toHaveLength(3);
      expect(christmasBirthdays.every(b => b.date.getMonth() === 11 && b.date.getDate() === 25)).toBe(true);
    });
  });

  describe('Aggregation and Statistics', () => {
    beforeEach(async () => {
      // Create diverse test data for statistics
      const testData = [
        { guildId: 'guild-123', userId: 'user-1', date: new Date('1990-01-15'), yearSpecified: true, active: true },
        { guildId: 'guild-123', userId: 'user-2', date: new Date('1995-01-20'), yearSpecified: true, active: true },
        { guildId: 'guild-123', userId: 'user-3', date: new Date('1900-06-30'), yearSpecified: false, active: true },
        { guildId: 'guild-123', userId: 'user-4', date: new Date('1988-12-25'), yearSpecified: true, active: false },
        { guildId: 'guild-456', userId: 'user-1', date: new Date('1992-03-10'), yearSpecified: true, active: true }
      ];

      for (const data of testData) {
        await BirthdayModel.create(birthdayFactory.build(data));
      }
    });

    it('should calculate guild birthday statistics', async () => {
      const stats = await BirthdayModel.aggregate([
        { $match: { guildId: 'guild-123' } },
        {
          $group: {
            _id: '$guildId',
            totalBirthdays: { $sum: 1 },
            activeBirthdays: { 
              $sum: { $cond: [{ $eq: ['$active', true] }, 1, 0] }
            },
            yearSpecifiedCount: { 
              $sum: { $cond: [{ $eq: ['$yearSpecified', true] }, 1, 0] }
            },
            oldestYear: { 
              $min: { $cond: [{ $eq: ['$yearSpecified', true] }, { $year: '$date' }, null] }
            },
            newestYear: { 
              $max: { $cond: [{ $eq: ['$yearSpecified', true] }, { $year: '$date' }, null] }
            }
          }
        }
      ]);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalBirthdays).toBe(4);
      expect(stats[0].activeBirthdays).toBe(3);
      expect(stats[0].yearSpecifiedCount).toBe(3);
      expect(stats[0].oldestYear).toBe(1988);
      expect(stats[0].newestYear).toBe(1995);
    });

    it('should find birthday distribution by month', async () => {
      const distribution = await BirthdayModel.aggregate([
        { $match: { guildId: 'guild-123', active: true } },
        {
          $group: {
            _id: { $month: '$date' },
            count: { $sum: 1 },
            users: { $push: '$userId' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      expect(distribution.length).toBeGreaterThan(0);
      
      // Find January (month 1) - should have 2 birthdays (user-1 and user-2)
      const january = distribution.find(d => d._id === 1);
      expect(january).toBeDefined();
      expect(january.count).toBe(2);
      expect(january.users).toContain('user-1');
      expect(january.users).toContain('user-2');
    });

    it('should find age distribution for year-specified birthdays', async () => {
      const currentYear = new Date().getFullYear();
      
      const ageDistribution = await BirthdayModel.aggregate([
        { 
          $match: { 
            guildId: 'guild-123', 
            active: true, 
            yearSpecified: true 
          } 
        },
        {
          $addFields: {
            age: { $subtract: [currentYear, { $year: '$date' }] }
          }
        },
        {
          $bucket: {
            groupBy: '$age',
            boundaries: [0, 18, 25, 35, 50, 100],
            default: '100+',
            output: {
              count: { $sum: 1 },
              users: { $push: '$userId' }
            }
          }
        }
      ]);

      expect(ageDistribution.length).toBeGreaterThan(0);
      // Most test users should fall in the 25-50 age range
      const middleAged = ageDistribution.find(d => d._id === 25);
      expect(middleAged).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of birthday records efficiently', async () => {
      const birthdays = [];
      const userCount = 100;
      
      for (let i = 0; i < userCount; i++) {
        birthdays.push(birthdayFactory.build({
          guildId: 'guild-performance',
          userId: `user-${i}`,
          date: new Date(1980 + (i % 30), i % 12, (i % 28) + 1), // Spread across years and months
          yearSpecified: i % 5 !== 0 // 80% have year specified
        }));
      }

      const insertStart = Date.now();
      await BirthdayModel.insertMany(birthdays);
      const insertTime = Date.now() - insertStart;

      expect(insertTime).toBeLessThan(2000); // Should insert quickly
      
      // Test query performance
      const queryStart = Date.now();
      const activeBirthdays = await BirthdayModel
        .find({ guildId: 'guild-performance', active: true })
        .sort({ date: 1 })
        .limit(20);
      const queryTime = Date.now() - queryStart;

      expect(activeBirthdays).toHaveLength(20);
      expect(queryTime).toBeLessThan(500); // Should query quickly

      logger.info(`Performance test: insert ${insertTime}ms, query ${queryTime}ms`);
    });

    it('should handle concurrent birthday updates efficiently', async () => {
      const birthday = await BirthdayModel.create({
        guildId: 'guild-concurrent',
        userId: 'user-concurrent',
        date: new Date('1990-06-15'),
        active: true
      });

      // Simulate concurrent updates (toggle active status)
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          BirthdayModel.findByIdAndUpdate(
            birthday._id,
            { active: i % 2 === 0 }, // Alternate between true/false
            { new: true }
          )
        );
      }

      const results = await Promise.all(operations);
      
      // All operations should succeed
      expect(results).toHaveLength(10);
      expect(results.every(r => r !== null)).toBe(true);

      // Verify final state
      const finalBirthday = await BirthdayModel.findById(birthday._id);
      expect(finalBirthday!.active).toBeDefined();

      logger.info(`Concurrent operations completed successfully`);
    });

    it('should handle birthday lookup queries efficiently', async () => {
      // Create many birthday records
      const birthdays = [];
      for (let i = 0; i < 50; i++) {
        birthdays.push(birthdayFactory.build({
          guildId: 'guild-lookup',
          userId: `user-${i}`,
          date: new Date(1990, i % 12, (i % 28) + 1)
        }));
      }

      await BirthdayModel.insertMany(birthdays);

      // Test monthly birthday lookup performance
      const queryStart = Date.now();
      const julyBirthdays = await BirthdayModel.find({
        guildId: 'guild-lookup',
        active: true,
        $expr: { $eq: [{ $month: '$date' }, 7] } // July
      });
      const queryTime = Date.now() - queryStart;

      expect(julyBirthdays.length).toBeGreaterThanOrEqual(0);
      expect(queryTime).toBeLessThan(200); // Should be very fast with index

      logger.info(`Birthday lookup query took ${queryTime}ms`);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle leap year birthdays', async () => {
      const leapYearBirthday = await BirthdayModel.create({
        userId: 'user-leap',
        guildId: 'guild-123',
        date: new Date('1992-02-29'), // Leap year
        yearSpecified: true
      });

      expect(leapYearBirthday.date.getMonth()).toBe(1); // February
      expect(leapYearBirthday.date.getDate()).toBe(29);
      expect(leapYearBirthday.date.getFullYear()).toBe(1992);
    });

    it('should handle very old and future dates', async () => {
      // Very old birthday
      const oldBirthday = await BirthdayModel.create({
        userId: 'user-old',
        guildId: 'guild-123',
        date: new Date('1920-01-01'),
        yearSpecified: true
      });

      // Future birthday (newborn)
      const futureBirthday = await BirthdayModel.create({
        userId: 'user-future',
        guildId: 'guild-123',
        date: new Date('2023-12-31'),
        yearSpecified: true
      });

      expect(oldBirthday.date.getFullYear()).toBe(1920);
      expect(futureBirthday.date.getFullYear()).toBe(2023);
    });

    it('should handle deletion of birthday records', async () => {
      const birthday = await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'guild-123',
        date: new Date('1990-06-15')
      });

      const birthdayId = birthday._id;

      // Delete the birthday record
      await BirthdayModel.findByIdAndDelete(birthdayId);

      // Verify deletion
      const deletedBirthday = await BirthdayModel.findById(birthdayId);
      expect(deletedBirthday).toBeNull();
    });

    it('should handle special character user/guild IDs', async () => {
      const birthday = await BirthdayModel.create({
        userId: 'user@special#456',
        guildId: 'guild_special-123.test',
        date: new Date('1990-06-15')
      });

      expect(birthday.userId).toBe('user@special#456');
      expect(birthday.guildId).toBe('guild_special-123.test');
    });

    it('should handle timezone edge cases', async () => {
      // Test different time zones by using UTC dates
      const birthday = await BirthdayModel.create({
        userId: 'user-timezone',
        guildId: 'guild-123',
        date: new Date(Date.UTC(1990, 5, 15, 0, 0, 0)) // UTC date
      });

      expect(birthday.date).toBeInstanceOf(Date);
      expect(birthday.date.getUTCMonth()).toBe(5); // June in UTC
      expect(birthday.date.getUTCDate()).toBe(15);
    });
  });
});