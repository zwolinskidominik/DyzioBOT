import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DbManager } from '../setup/db';
import { AutoRoleModel } from '../../../src/models/AutoRole';
import { autoRoleFactory } from '../factories';
import { clearTestData } from '../helpers/seeding';
import logger from '../../../src/utils/logger';

describe('AutoRole Model Integration Tests', () => {
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
    it('should create a valid AutoRole configuration with roles', async () => {
      const autoRoleData = autoRoleFactory.build({
        guildId: 'guild-123',
        roleIds: ['role-1', 'role-2', 'role-3']
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);

      expect(autoRole).toBeDefined();
      expect(autoRole.guildId).toBe('guild-123');
      expect(autoRole.roleIds).toHaveLength(3);
      expect(autoRole.roleIds).toEqual(['role-1', 'role-2', 'role-3']);
    });

    it('should require guildId field', async () => {
      const autoRoleData = {
        roleIds: ['role-1', 'role-2']
        // Missing guildId
      };

      await expect(AutoRoleModel.create(autoRoleData)).rejects.toThrow(/guildId.*required/);
    });

    it('should create AutoRole with empty role list by default', async () => {
      const autoRoleData = {
        guildId: 'guild-123'
        // No roleIds provided
      };

      const autoRole = await AutoRoleModel.create(autoRoleData);

      expect(autoRole.roleIds).toHaveLength(0);
      expect(autoRole.roleIds).toEqual([]);
    });

    it('should handle single role configuration', async () => {
      const autoRoleData = autoRoleFactory.buildSingleRole({
        guildId: 'guild-123'
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);

      expect(autoRole.roleIds).toHaveLength(1);
      expect(typeof autoRole.roleIds[0]).toBe('string');
    });

    it('should handle multiple role configuration', async () => {
      const autoRoleData = autoRoleFactory.buildMultipleRoles(5, {
        guildId: 'guild-123'
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);

      expect(autoRole.roleIds).toHaveLength(5);
      expect(autoRole.roleIds.every(id => typeof id === 'string')).toBe(true);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique constraint on guildId', async () => {
      const autoRole1Data = autoRoleFactory.build({
        guildId: 'guild-unique-test',
        roleIds: ['role-1', 'role-2']
      });

      await AutoRoleModel.create(autoRole1Data);

      // Try to create another AutoRole for the same guild
      const autoRole2Data = autoRoleFactory.build({
        guildId: 'guild-unique-test', // same guild
        roleIds: ['role-3', 'role-4']
      });

      await expect(AutoRoleModel.create(autoRole2Data)).rejects.toThrow(/duplicate key/);
    });

    it('should allow different guilds with same role IDs', async () => {
      const sharedRoleIds = ['role-shared-1', 'role-shared-2'];

      const autoRole1Data = autoRoleFactory.build({
        guildId: 'guild-1',
        roleIds: sharedRoleIds
      });

      const autoRole2Data = autoRoleFactory.build({
        guildId: 'guild-2',
        roleIds: sharedRoleIds
      });

      const autoRole1 = await AutoRoleModel.create(autoRole1Data);
      const autoRole2 = await AutoRoleModel.create(autoRole2Data);

      expect(autoRole1).toBeDefined();
      expect(autoRole2).toBeDefined();
      expect(autoRole1.guildId).toBe('guild-1');
      expect(autoRole2.guildId).toBe('guild-2');
      expect(autoRole1.roleIds).toEqual(sharedRoleIds);
      expect(autoRole2.roleIds).toEqual(sharedRoleIds);
    });
  });

  describe('Role Management Operations', () => {
    it('should handle updating role list', async () => {
      const autoRoleData = autoRoleFactory.build({
        guildId: 'guild-update',
        roleIds: ['role-1', 'role-2']
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);

      // Update role list
      autoRole.roleIds = ['role-1', 'role-2', 'role-3', 'role-4'];
      await autoRole.save();

      const updatedAutoRole = await AutoRoleModel.findById(autoRole._id);
      expect(updatedAutoRole!.roleIds).toHaveLength(4);
      expect(updatedAutoRole!.roleIds).toContain('role-3');
      expect(updatedAutoRole!.roleIds).toContain('role-4');
    });

    it('should handle adding single role', async () => {
      const autoRole = await AutoRoleModel.create({
        guildId: 'guild-add-role',
        roleIds: ['role-1']
      });

      // Add new role
      autoRole.roleIds.push('role-2');
      await autoRole.save();

      const updatedAutoRole = await AutoRoleModel.findById(autoRole._id);
      expect(updatedAutoRole!.roleIds).toHaveLength(2);
      expect(updatedAutoRole!.roleIds).toContain('role-2');
    });

    it('should handle removing specific role', async () => {
      const autoRole = await AutoRoleModel.create({
        guildId: 'guild-remove-role',
        roleIds: ['role-1', 'role-2', 'role-3']
      });

      // Remove middle role
      autoRole.roleIds = autoRole.roleIds.filter(id => id !== 'role-2');
      await autoRole.save();

      const updatedAutoRole = await AutoRoleModel.findById(autoRole._id);
      expect(updatedAutoRole!.roleIds).toHaveLength(2);
      expect(updatedAutoRole!.roleIds).toEqual(['role-1', 'role-3']);
    });

    it('should handle clearing all roles', async () => {
      const autoRole = await AutoRoleModel.create({
        guildId: 'guild-clear-roles',
        roleIds: ['role-1', 'role-2', 'role-3']
      });

      // Clear all roles
      autoRole.roleIds = [];
      await autoRole.save();

      const clearedAutoRole = await AutoRoleModel.findById(autoRole._id);
      expect(clearedAutoRole!.roleIds).toHaveLength(0);
    });

    it('should handle upsert operations', async () => {
      const guildId = 'guild-upsert';
      const initialRoles = ['role-1', 'role-2'];

      // Create or update AutoRole configuration
      await AutoRoleModel.findOneAndUpdate(
        { guildId },
        { roleIds: initialRoles },
        { upsert: true, new: true }
      );

      const autoRole = await AutoRoleModel.findOne({ guildId });
      expect(autoRole).toBeDefined();
      expect(autoRole!.roleIds).toEqual(initialRoles);

      // Update existing configuration
      const updatedRoles = ['role-1', 'role-2', 'role-3'];
      await AutoRoleModel.findOneAndUpdate(
        { guildId },
        { roleIds: updatedRoles },
        { upsert: true, new: true }
      );

      const updatedAutoRole = await AutoRoleModel.findOne({ guildId });
      expect(updatedAutoRole!.roleIds).toEqual(updatedRoles);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create test AutoRole configurations
      const testConfigs = [
        { guildId: 'guild-query-1', roleIds: ['role-a', 'role-b'] },
        { guildId: 'guild-query-2', roleIds: ['role-c', 'role-d', 'role-e'] },
        { guildId: 'guild-query-3', roleIds: [] }, // No roles
        { guildId: 'guild-query-4', roleIds: ['role-f'] }, // Single role
      ];

      for (const config of testConfigs) {
        await AutoRoleModel.create(autoRoleFactory.build(config));
      }
    });

    it('should find AutoRole by guild ID', async () => {
      const autoRole = await AutoRoleModel.findOne({ guildId: 'guild-query-1' });

      expect(autoRole).toBeDefined();
      expect(autoRole!.guildId).toBe('guild-query-1');
      expect(autoRole!.roleIds).toEqual(['role-a', 'role-b']);
    });

    it('should find guilds with configured roles', async () => {
      const configsWithRoles = await AutoRoleModel.find({
        'roleIds.0': { $exists: true } // Has at least one role
      });

      expect(configsWithRoles).toHaveLength(3); // guild-query-1, 2, 4
      expect(configsWithRoles.map(c => c.guildId)).not.toContain('guild-query-3');
    });

    it('should find guilds with empty role configurations', async () => {
      const emptyConfigs = await AutoRoleModel.find({
        roleIds: { $size: 0 }
      });

      expect(emptyConfigs).toHaveLength(1);
      expect(emptyConfigs[0].guildId).toBe('guild-query-3');
    });

    it('should find guilds with specific role', async () => {
      const guildsWithRoleC = await AutoRoleModel.find({
        roleIds: 'role-c'
      });

      expect(guildsWithRoleC).toHaveLength(1);
      expect(guildsWithRoleC[0].guildId).toBe('guild-query-2');
    });

    it('should count role configurations by guild count', async () => {
      const totalConfigs = await AutoRoleModel.countDocuments();
      expect(totalConfigs).toBe(4);

      const configsWithRoles = await AutoRoleModel.countDocuments({
        'roleIds.0': { $exists: true }
      });
      expect(configsWithRoles).toBe(3);
    });

    it('should find guilds with multiple roles', async () => {
      const multiRoleGuilds = await AutoRoleModel.find({
        'roleIds.1': { $exists: true } // Has at least 2 roles
      });

      expect(multiRoleGuilds).toHaveLength(2); // guild-query-1 and guild-query-2
      expect(multiRoleGuilds.map(g => g.guildId)).toEqual(
        expect.arrayContaining(['guild-query-1', 'guild-query-2'])
      );
    });
  });

  describe('Aggregation and Statistics', () => {
    beforeEach(async () => {
      // Create diverse test data
      const testData = [
        { guildId: 'guild-stat-1', roleIds: ['role-1', 'role-2'] },
        { guildId: 'guild-stat-2', roleIds: ['role-3', 'role-4', 'role-5'] },
        { guildId: 'guild-stat-3', roleIds: [] },
        { guildId: 'guild-stat-4', roleIds: ['role-6'] },
        { guildId: 'guild-stat-5', roleIds: ['role-7', 'role-8', 'role-9', 'role-10'] },
      ];

      for (const data of testData) {
        await AutoRoleModel.create(autoRoleFactory.build(data));
      }
    });

    it('should calculate AutoRole statistics', async () => {
      const stats = await AutoRoleModel.aggregate([
        {
          $project: {
            guildId: 1,
            roleCount: { $size: '$roleIds' },
            hasRoles: { $gt: [{ $size: '$roleIds' }, 0] }
          }
        },
        {
          $group: {
            _id: null,
            totalGuilds: { $sum: 1 },
            guildsWithRoles: { $sum: { $cond: ['$hasRoles', 1, 0] } },
            guildsWithoutRoles: { $sum: { $cond: ['$hasRoles', 0, 1] } },
            totalRoles: { $sum: '$roleCount' },
            averageRolesPerGuild: { $avg: '$roleCount' },
            maxRolesPerGuild: { $max: '$roleCount' }
          }
        }
      ]);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalGuilds).toBe(5);
      expect(stats[0].guildsWithRoles).toBe(4);
      expect(stats[0].guildsWithoutRoles).toBe(1);
      expect(stats[0].totalRoles).toBe(10); // 2+3+0+1+4
      expect(stats[0].averageRolesPerGuild).toBe(2);
      expect(stats[0].maxRolesPerGuild).toBe(4);
    });

    it('should find most role-heavy guilds', async () => {
      const heaviestGuilds = await AutoRoleModel.aggregate([
        {
          $project: {
            guildId: 1,
            roleCount: { $size: '$roleIds' },
            roleIds: 1
          }
        },
        { $match: { roleCount: { $gt: 0 } } },
        { $sort: { roleCount: -1 } },
        { $limit: 3 }
      ]);

      expect(heaviestGuilds).toHaveLength(3);
      expect(heaviestGuilds[0].guildId).toBe('guild-stat-5');
      expect(heaviestGuilds[0].roleCount).toBe(4);
    });

    it('should analyze role distribution', async () => {
      const distribution = await AutoRoleModel.aggregate([
        {
          $project: {
            roleCount: { $size: '$roleIds' }
          }
        },
        {
          $group: {
            _id: '$roleCount',
            guildCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Expect: 0 roles (1 guild), 1 role (1 guild), 2 roles (1 guild), 3 roles (1 guild), 4 roles (1 guild)
      expect(distribution).toHaveLength(5);
      expect(distribution.every(d => d.guildCount === 1)).toBe(true);
    });

    it('should find all unique roles across guilds', async () => {
      const allRoles = await AutoRoleModel.aggregate([
        { $unwind: '$roleIds' },
        {
          $group: {
            _id: '$roleIds',
            guildsUsingRole: { $addToSet: '$guildId' },
            usageCount: { $sum: 1 }
          }
        },
        { $sort: { usageCount: -1 } }
      ]);

      expect(allRoles).toHaveLength(10); // role-1 through role-10
      expect(allRoles.every(r => r.usageCount === 1)).toBe(true); // Each role used once
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of guilds efficiently', async () => {
      const configs = [];
      const guildCount = 100;
      
      for (let i = 0; i < guildCount; i++) {
        const roleCount = Math.floor(Math.random() * 10) + 1; // 1-10 roles per guild
        const roleIds = [];
        
        for (let j = 0; j < roleCount; j++) {
          roleIds.push(`role-${i}-${j}`);
        }

        configs.push(autoRoleFactory.build({
          guildId: `guild-perf-${i}`,
          roleIds
        }));
      }

      const insertStart = Date.now();
      await AutoRoleModel.insertMany(configs);
      const insertTime = Date.now() - insertStart;

      expect(insertTime).toBeLessThan(2000); // Should insert quickly
      
      // Test query performance
      const queryStart = Date.now();
      const configsWithManyRoles = await AutoRoleModel.find({
        'roleIds.4': { $exists: true } // At least 5 roles
      });
      const queryTime = Date.now() - queryStart;

      expect(configsWithManyRoles.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(500); // Should query quickly

      logger.info(`Performance test: insert ${insertTime}ms, query ${queryTime}ms`);
    });

    it('should handle bulk updates efficiently', async () => {
      // Create initial configurations
      const configs = [];
      for (let i = 0; i < 50; i++) {
        configs.push(autoRoleFactory.build({
          guildId: `guild-bulk-${i}`,
          roleIds: [`role-initial-${i}`]
        }));
      }

      await AutoRoleModel.insertMany(configs);

      // Bulk add role to all configurations
      const updateStart = Date.now();
      await AutoRoleModel.updateMany(
        { guildId: { $regex: /^guild-bulk-/ } },
        { $push: { roleIds: 'role-bulk-added' } }
      );
      const updateTime = Date.now() - updateStart;

      expect(updateTime).toBeLessThan(1000); // Should update quickly

      // Verify all configurations have the new role
      const updatedConfigs = await AutoRoleModel.find({ 
        guildId: { $regex: /^guild-bulk-/ } 
      });
      
      expect(updatedConfigs).toHaveLength(50);
      expect(updatedConfigs.every(c => c.roleIds.includes('role-bulk-added'))).toBe(true);

      logger.info(`Bulk update took ${updateTime}ms`);
    });

    it('should handle concurrent role operations efficiently', async () => {
      const guildId = 'guild-concurrent';

      // Create initial configuration
      await AutoRoleModel.create({
        guildId,
        roleIds: []
      });

      // Simulate concurrent role additions
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          AutoRoleModel.findOneAndUpdate(
            { guildId },
            { $addToSet: { roleIds: `role-concurrent-${i}` } },
            { new: true }
          )
        );
      }

      const results = await Promise.all(operations);
      
      // All operations should succeed
      expect(results).toHaveLength(10);
      expect(results.every(r => r !== null)).toBe(true);

      // Verify final state
      const finalConfig = await AutoRoleModel.findOne({ guildId });
      expect(finalConfig!.roleIds.length).toBeLessThanOrEqual(10);
      expect(finalConfig!.roleIds.length).toBeGreaterThan(0);

      logger.info(`Concurrent operations completed, final role count: ${finalConfig!.roleIds.length}`);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large role arrays', async () => {
      const largeRoleArray = [];
      for (let i = 0; i < 1000; i++) {
        largeRoleArray.push(`role-large-${i}`);
      }

      const autoRoleData = autoRoleFactory.build({
        guildId: 'guild-large-roles',
        roleIds: largeRoleArray
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);
      expect(autoRole.roleIds).toHaveLength(1000);
    });

    it('should handle special characters in role IDs', async () => {
      const specialRoleIds = [
        'role-with-hyphens',
        'role_with_underscores',
        'role.with.dots',
        'role@with@symbols',
        'role#with#hash'
      ];

      const autoRoleData = autoRoleFactory.build({
        guildId: 'guild-special-chars',
        roleIds: specialRoleIds
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);
      expect(autoRole.roleIds).toEqual(specialRoleIds);
    });

    it('should handle duplicate role IDs in array', async () => {
      const roleIdsWithDuplicates = ['role-1', 'role-2', 'role-1', 'role-3', 'role-2'];

      const autoRoleData = autoRoleFactory.build({
        guildId: 'guild-duplicates',
        roleIds: roleIdsWithDuplicates
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);
      
      // MongoDB should preserve the array as-is (duplicates included)
      expect(autoRole.roleIds).toEqual(roleIdsWithDuplicates);
      expect(autoRole.roleIds).toHaveLength(5);
    });

    it('should handle deletion of AutoRole configurations', async () => {
      const autoRoleData = autoRoleFactory.build({
        guildId: 'guild-delete',
        roleIds: ['role-1', 'role-2']
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);
      const autoRoleId = autoRole._id;

      // Delete the configuration
      await AutoRoleModel.findByIdAndDelete(autoRoleId);

      // Verify deletion
      const deletedAutoRole = await AutoRoleModel.findById(autoRoleId);
      expect(deletedAutoRole).toBeNull();
    });

    it('should handle empty string role IDs', async () => {
      const roleIdsWithEmpty = ['role-1', '', 'role-2', '   ', 'role-3'];

      const autoRoleData = autoRoleFactory.build({
        guildId: 'guild-empty-strings',
        roleIds: roleIdsWithEmpty
      });

      const autoRole = await AutoRoleModel.create(autoRoleData);
      expect(autoRole.roleIds).toEqual(roleIdsWithEmpty);
    });
  });
});