import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { TicketConfigModel } from '../../../src/models/TicketConfig';
import { ticketConfigFactory } from '../factories';
import { clearTestData } from '../helpers/seeding';
import logger from '../../../src/utils/logger';

describe('TicketConfig Model Integration Tests', () => {
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
    it('should create a valid ticket config record', async () => {
      const configData = ticketConfigFactory.build({
        guildId: 'guild-123',
        categoryId: 'category-123'
      });

      const config = await TicketConfigModel.create(configData);

      expect(config).toBeDefined();
      expect(config.guildId).toBe('guild-123');
      expect(config.categoryId).toBe('category-123');
    });

    it('should require guildId field', async () => {
      const configData = {
        categoryId: 'category-123'
      };

      await expect(TicketConfigModel.create(configData)).rejects.toThrow(/guildId.*required/);
    });

    it('should require categoryId field', async () => {
      const configData = {
        guildId: 'guild-123'
      };

      await expect(TicketConfigModel.create(configData)).rejects.toThrow(/categoryId.*required/);
    });

    it('should validate field types', async () => {
      const configData = {
        guildId: 'guild-123',
        categoryId: 'category-123'
      };

      const config = await TicketConfigModel.create(configData);

      expect(typeof config.guildId).toBe('string');
      expect(typeof config.categoryId).toBe('string');
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique constraint on guildId', async () => {
      const config1Data = ticketConfigFactory.build({
        guildId: 'guild-123',
        categoryId: 'category-123'
      });

      await TicketConfigModel.create(config1Data);

      const config2Data = ticketConfigFactory.build({
        guildId: 'guild-123',
        categoryId: 'category-456'
      });

      await expect(TicketConfigModel.create(config2Data)).rejects.toThrow(/duplicate key/);
    });

    it('should allow different guildIds', async () => {
      const config1Data = ticketConfigFactory.build({
        guildId: 'guild-123',
        categoryId: 'category-123'
      });

      const config2Data = ticketConfigFactory.build({
        guildId: 'guild-456',
        categoryId: 'category-456'
      });

      const config1 = await TicketConfigModel.create(config1Data);
      const config2 = await TicketConfigModel.create(config2Data);

      expect(config1).toBeDefined();
      expect(config2).toBeDefined();
      expect(config1.guildId).toBe('guild-123');
      expect(config2.guildId).toBe('guild-456');
    });

    it('should allow same categoryId for different guilds', async () => {
      const config1Data = ticketConfigFactory.build({
        guildId: 'guild-123',
        categoryId: 'category-shared'
      });

      const config2Data = ticketConfigFactory.build({
        guildId: 'guild-456',
        categoryId: 'category-shared'
      });

      const config1 = await TicketConfigModel.create(config1Data);
      const config2 = await TicketConfigModel.create(config2Data);

      expect(config1).toBeDefined();
      expect(config2).toBeDefined();
      expect(config1.categoryId).toBe('category-shared');
      expect(config2.categoryId).toBe('category-shared');
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration settings', async () => {
      const configData = ticketConfigFactory.build({
        guildId: 'guild-123',
        categoryId: 'category-123'
      });

      const config = await TicketConfigModel.create(configData);

      config.categoryId = 'new-category-456';
      await config.save();

      const updatedConfig = await TicketConfigModel.findById(config._id);
      expect(updatedConfig!.categoryId).toBe('new-category-456');
      expect(updatedConfig!.guildId).toBe('guild-123');
    });

    it('should handle partial updates using findOneAndUpdate', async () => {
      const configData = ticketConfigFactory.build({
        guildId: 'guild-123',
        categoryId: 'category-123'
      });

      const config = await TicketConfigModel.create(configData);

      const updatedConfig = await TicketConfigModel.findOneAndUpdate(
        { guildId: 'guild-123' },
        { categoryId: 'updated-category' },
        { new: true }
      );

      expect(updatedConfig!.categoryId).toBe('updated-category');
      expect(updatedConfig!.guildId).toBe('guild-123');
      expect(updatedConfig!._id.toString()).toBe(config._id.toString());
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const testConfigs = [
        {
          guildId: 'guild-active-1',
          categoryId: 'category-1'
        },
        {
          guildId: 'guild-active-2',
          categoryId: 'category-2'
        },
        {
          guildId: 'guild-test-3',
          categoryId: 'category-3'
        }
      ];

      for (const data of testConfigs) {
        await TicketConfigModel.create(ticketConfigFactory.build(data));
      }
    });

    it('should find configuration by guildId', async () => {
      const config = await TicketConfigModel.findOne({ guildId: 'guild-active-1' });

      expect(config).toBeDefined();
      expect(config!.guildId).toBe('guild-active-1');
      expect(config!.categoryId).toBe('category-1');
    });

    it('should find configuration by categoryId', async () => {
      const config = await TicketConfigModel.findOne({ categoryId: 'category-2' });

      expect(config).toBeDefined();
      expect(config!.guildId).toBe('guild-active-2');
      expect(config!.categoryId).toBe('category-2');
    });

    it('should find multiple configurations', async () => {
      const configs = await TicketConfigModel.find({
        guildId: { $in: ['guild-active-1', 'guild-active-2'] }
      });

      expect(configs).toHaveLength(2);
      expect(configs.map(c => c.guildId)).toContain('guild-active-1');
      expect(configs.map(c => c.guildId)).toContain('guild-active-2');
    });

    it('should find configurations with regex patterns', async () => {
      const configs = await TicketConfigModel.find({
        guildId: { $regex: /^guild-active/ }
      });

      expect(configs).toHaveLength(2);
      expect(configs.every(c => c.guildId.startsWith('guild-active'))).toBe(true);
    });

    it('should return empty array for non-existent guild', async () => {
      const configs = await TicketConfigModel.find({ guildId: 'non-existent-guild' });

      expect(configs).toHaveLength(0);
    });
  });

  describe('Aggregation and Statistics', () => {
    beforeEach(async () => {
      const testData = [
        { guildId: 'guild-1', categoryId: 'category-tickets' },
        { guildId: 'guild-2', categoryId: 'category-support' },
        { guildId: 'guild-3', categoryId: 'category-tickets' },
        { guildId: 'guild-4', categoryId: 'category-help' },
        { guildId: 'guild-5', categoryId: 'category-support' }
      ];

      for (const data of testData) {
        await TicketConfigModel.create(ticketConfigFactory.build(data));
      }
    });

    it('should calculate basic statistics', async () => {
      const stats = await TicketConfigModel.aggregate([
        {
          $group: {
            _id: null,
            totalConfigs: { $sum: 1 },
            uniqueCategories: { $addToSet: '$categoryId' },
            uniqueGuilds: { $addToSet: '$guildId' }
          }
        }
      ]);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalConfigs).toBe(5);
      expect(stats[0].uniqueCategories).toHaveLength(3);
      expect(stats[0].uniqueGuilds).toHaveLength(5);
    });

    it('should group configurations by categoryId', async () => {
      const groupedStats = await TicketConfigModel.aggregate([
        {
          $group: {
            _id: '$categoryId',
            count: { $sum: 1 },
            guilds: { $push: '$guildId' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      expect(groupedStats).toHaveLength(3);
      
      const mostPopular = groupedStats[0];
      expect(['category-tickets', 'category-support']).toContain(mostPopular._id);
      expect(mostPopular.count).toBe(2);
    });

    it('should find configurations with specific category patterns', async () => {
      const categoryStats = await TicketConfigModel.aggregate([
        {
          $match: {
            categoryId: { $regex: /^category-(tickets|support)$/ }
          }
        },
        {
          $group: {
            _id: '$categoryId',
            guilds: { $push: '$guildId' },
            count: { $sum: 1 }
          }
        }
      ]);

      expect(categoryStats).toHaveLength(2);
      expect(categoryStats.reduce((sum, cat) => sum + cat.count, 0)).toBe(4);
    });

    it('should count unique category types', async () => {
      const uniqueCategories = await TicketConfigModel.distinct('categoryId');

      expect(uniqueCategories).toHaveLength(3);
      expect(uniqueCategories).toContain('category-tickets');
      expect(uniqueCategories).toContain('category-support');
      expect(uniqueCategories).toContain('category-help');
    });
  });

  describe('Performance and Validation', () => {
    it('should handle concurrent configuration updates', async () => {
      const configData = ticketConfigFactory.build({
        guildId: 'guild-concurrent',
        categoryId: 'category-concurrent'
      });

      const config = await TicketConfigModel.create(configData);

      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push(
          TicketConfigModel.findByIdAndUpdate(
            config._id,
            { categoryId: `category-update-${i}` },
            { new: true }
          )
        );
      }

      const results = await Promise.all(updates);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r !== null)).toBe(true);
      const finalConfig = await TicketConfigModel.findById(config._id);
      expect(finalConfig!.categoryId).toMatch(/^category-update-\d+$/);

      logger.info(`Final categoryId after concurrent updates: ${finalConfig!.categoryId}`);
    });

    it('should handle very long snowflake IDs', async () => {
      const longSnowflake = '1234567890123456789';
      
      const configData = ticketConfigFactory.build({
        guildId: longSnowflake,
        categoryId: longSnowflake
      });

      const config = await TicketConfigModel.create(configData);
      
      expect(config.guildId).toBe(longSnowflake);
      expect(config.categoryId).toBe(longSnowflake);
    });

    it('should handle bulk configuration operations efficiently', async () => {
      const configs = [];
      
      for (let i = 0; i < 100; i++) {
        configs.push(ticketConfigFactory.build({
          guildId: `guild-bulk-${i}`,
          categoryId: `category-${i % 5}`
        }));
      }

      const startTime = Date.now();
      await TicketConfigModel.insertMany(configs);
      const insertTime = Date.now() - startTime;

      expect(insertTime).toBeLessThan(1000);

      const count = await TicketConfigModel.countDocuments({
        guildId: { $regex: /^guild-bulk-/ }
      });
      expect(count).toBe(100);
      const updateStart = Date.now();
      await TicketConfigModel.updateMany(
        { guildId: { $regex: /^guild-bulk-/ } },
        { categoryId: 'bulk-updated-category' }
      );
      const updateTime = Date.now() - updateStart;

      expect(updateTime).toBeLessThan(500);
      const updatedCount = await TicketConfigModel.countDocuments({
        categoryId: 'bulk-updated-category'
      });
      expect(updatedCount).toBe(100);

      logger.info(`Bulk operations: insert ${insertTime}ms, update ${updateTime}ms`);
    });

    it('should maintain data consistency with upsert operations', async () => {
      const guildId = 'guild-upsert-test';
      const result1 = await TicketConfigModel.findOneAndUpdate(
        { guildId },
        {
          categoryId: 'category-upsert'
        },
        { upsert: true, new: true }
      );

      expect(result1).toBeDefined();
      expect(result1.guildId).toBe(guildId);
      expect(result1.categoryId).toBe('category-upsert');

      const result2 = await TicketConfigModel.findOneAndUpdate(
        { guildId },
        {
          categoryId: 'category-updated'
        },
        { upsert: true, new: true }
      );

      expect(result2).toBeDefined();
      expect(result2._id.toString()).toBe(result1._id.toString());
      expect(result2.categoryId).toBe('category-updated');
      expect(result2.guildId).toBe(guildId);
    });

    it('should handle special characters in IDs', async () => {
      const specialGuildId = 'guild-123_test-special.chars';
      const specialCategoryId = 'category-456_test-special.chars';
      
      const configData = ticketConfigFactory.build({
        guildId: specialGuildId,
        categoryId: specialCategoryId
      });

      const config = await TicketConfigModel.create(configData);
      
      expect(config.guildId).toBe(specialGuildId);
      expect(config.categoryId).toBe(specialCategoryId);
      const foundConfig = await TicketConfigModel.findOne({ guildId: specialGuildId });
      expect(foundConfig).toBeDefined();
      expect(foundConfig!.categoryId).toBe(specialCategoryId);
    });

    it('should handle deletion operations', async () => {
      const configData = ticketConfigFactory.build({
        guildId: 'guild-to-delete',
        categoryId: 'category-to-delete'
      });

      const config = await TicketConfigModel.create(configData);
      const configId = config._id;

      await TicketConfigModel.findByIdAndDelete(configId);
      const deletedConfig = await TicketConfigModel.findById(configId);
      expect(deletedConfig).toBeNull();
      const configByGuild = await TicketConfigModel.findOne({ guildId: 'guild-to-delete' });
      expect(configByGuild).toBeNull();
    });
  });
});