import { describe, beforeAll, afterEach, afterAll, it, expect, jest } from '@jest/globals';
import { LevelConfigModel, LevelConfig } from '../../../src/models/LevelConfig';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';
import mongoose from 'mongoose';

describe('LevelConfig Model Unit Tests', () => {
  beforeAll(async () => {
    await connectTestDb();
    await LevelConfigModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('Schema Validation', () => {
    it('should create a LevelConfig with minimal required fields', async () => {
      const config = await LevelConfigModel.create({
        guildId: 'guild123'
      });

      expect(config.guildId).toBe('guild123');
      expect(config._id).toBeDefined();
    });

    it('should require guildId field', async () => {
      await expect(LevelConfigModel.create({} as any)).rejects.toThrow();
    });

    it('should reject empty guildId', async () => {
      await expect(LevelConfigModel.create({ guildId: '' })).rejects.toThrow();
    });

    it('should reject null or undefined guildId', async () => {
      await expect(LevelConfigModel.create({ guildId: null } as any)).rejects.toThrow();
      await expect(LevelConfigModel.create({ guildId: undefined } as any)).rejects.toThrow();
    });
  });

  describe('Default Values', () => {
    it('should set correct default values for all fields', async () => {
      const config = await LevelConfigModel.create({
        guildId: 'defaults-test'
      });

      expect(config.xpPerMsg).toBe(5);
      expect(config.xpPerMinVc).toBe(10);
      expect(config.cooldownSec).toBe(0);
      expect(config.notifyChannelId).toBeUndefined();
      expect(config.levelUpMessage).toBe('{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏');
      expect(config.rewardMessage).toBe('{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!');
      expect(config.roleRewards).toEqual([]);
      expect(Array.isArray(config.roleRewards)).toBe(true);
    });

    it('should allow overriding default values', async () => {
      const customConfig = await LevelConfigModel.create({
        guildId: 'custom-defaults',
        xpPerMsg: 10,
        xpPerMinVc: 15,
        cooldownSec: 60,
        notifyChannelId: 'channel123',
        levelUpMessage: 'Custom level up message!',
        rewardMessage: 'Custom reward message!'
      });

      expect(customConfig.xpPerMsg).toBe(10);
      expect(customConfig.xpPerMinVc).toBe(15);
      expect(customConfig.cooldownSec).toBe(60);
      expect(customConfig.notifyChannelId).toBe('channel123');
      expect(customConfig.levelUpMessage).toBe('Custom level up message!');
      expect(customConfig.rewardMessage).toBe('Custom reward message!');
    });
  });

  describe('Validation Rules', () => {
    describe('xpPerMsg validation', () => {
      it('should accept valid xpPerMsg values (>= 0)', async () => {
        const config1 = await LevelConfigModel.create({ guildId: 'xp1', xpPerMsg: 0 });
        const config2 = await LevelConfigModel.create({ guildId: 'xp2', xpPerMsg: 1 });
        const config3 = await LevelConfigModel.create({ guildId: 'xp3', xpPerMsg: 100 });

        expect(config1.xpPerMsg).toBe(0);
        expect(config2.xpPerMsg).toBe(1);
        expect(config3.xpPerMsg).toBe(100);
      });

      it('should reject negative xpPerMsg', async () => {
        await expect(
          LevelConfigModel.create({ guildId: 'neg-xp', xpPerMsg: -1 })
        ).rejects.toThrow();

        await expect(
          LevelConfigModel.create({ guildId: 'neg-xp2', xpPerMsg: -100 })
        ).rejects.toThrow();
      });
    });

    describe('xpPerMinVc validation', () => {
      it('should accept valid xpPerMinVc values (>= 0)', async () => {
        const config1 = await LevelConfigModel.create({ guildId: 'vc1', xpPerMinVc: 0 });
        const config2 = await LevelConfigModel.create({ guildId: 'vc2', xpPerMinVc: 5 });
        const config3 = await LevelConfigModel.create({ guildId: 'vc3', xpPerMinVc: 50 });

        expect(config1.xpPerMinVc).toBe(0);
        expect(config2.xpPerMinVc).toBe(5);
        expect(config3.xpPerMinVc).toBe(50);
      });

      it('should reject negative xpPerMinVc', async () => {
        await expect(
          LevelConfigModel.create({ guildId: 'neg-vc', xpPerMinVc: -1 })
        ).rejects.toThrow();

        await expect(
          LevelConfigModel.create({ guildId: 'neg-vc2', xpPerMinVc: -50 })
        ).rejects.toThrow();
      });
    });

    describe('cooldownSec validation', () => {
      it('should accept valid cooldownSec values (>= 0)', async () => {
        const config1 = await LevelConfigModel.create({ guildId: 'cd1', cooldownSec: 0 });
        const config2 = await LevelConfigModel.create({ guildId: 'cd2', cooldownSec: 30 });
        const config3 = await LevelConfigModel.create({ guildId: 'cd3', cooldownSec: 3600 });

        expect(config1.cooldownSec).toBe(0);
        expect(config2.cooldownSec).toBe(30);
        expect(config3.cooldownSec).toBe(3600);
      });

      it('should reject negative cooldownSec', async () => {
        await expect(
          LevelConfigModel.create({ guildId: 'neg-cd', cooldownSec: -1 })
        ).rejects.toThrow();

        await expect(
          LevelConfigModel.create({ guildId: 'neg-cd2', cooldownSec: -30 })
        ).rejects.toThrow();
      });
    });
  });

  describe('RoleRewards Subdocument', () => {
    it('should allow adding valid roleRewards', async () => {
      const config = await LevelConfigModel.create({
        guildId: 'role-rewards-test',
        roleRewards: [
          { level: 5, roleId: 'role1' },
          { level: 10, roleId: 'role2', rewardMessage: 'Custom message!' }
        ]
      });

      expect(config.roleRewards).toHaveLength(2);
      expect(config.roleRewards[0].level).toBe(5);
      expect(config.roleRewards[0].roleId).toBe('role1');
      expect(config.roleRewards[0].rewardMessage).toBe('');
      expect(config.roleRewards[1].level).toBe(10);
      expect(config.roleRewards[1].roleId).toBe('role2');
      expect(config.roleRewards[1].rewardMessage).toBe('Custom message!');
    });

    it('should require level and roleId in roleRewards', async () => {
      await expect(
        LevelConfigModel.create({
          guildId: 'missing-level',
          roleRewards: [{ roleId: 'role1' } as any]
        })
      ).rejects.toThrow();

      await expect(
        LevelConfigModel.create({
          guildId: 'missing-role',
          roleRewards: [{ level: 5 } as any]
        })
      ).rejects.toThrow();
    });

    it('should reject empty roleId in roleRewards', async () => {
      await expect(
        LevelConfigModel.create({
          guildId: 'empty-role',
          roleRewards: [{ level: 5, roleId: '' }]
        })
      ).rejects.toThrow();
    });

    it('should require level >= 1 in roleRewards', async () => {
      await expect(
        LevelConfigModel.create({
          guildId: 'invalid-level',
          roleRewards: [{ level: 0, roleId: 'role1' }]
        })
      ).rejects.toThrow();

      await expect(
        LevelConfigModel.create({
          guildId: 'negative-level',
          roleRewards: [{ level: -1, roleId: 'role1' }]
        })
      ).rejects.toThrow();
    });

    it('should set default empty string for rewardMessage in roleRewards', async () => {
      const config = await LevelConfigModel.create({
        guildId: 'default-reward-msg',
        roleRewards: [{ level: 5, roleId: 'role1' }]
      });

      expect(config.roleRewards[0].rewardMessage).toBe('');
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique guildId constraint', async () => {
      const guildId = 'unique-constraint-test';
      
      // First creation should succeed
      await LevelConfigModel.create({ guildId });

      // Second creation with same guildId should fail
      await expect(
        LevelConfigModel.create({ guildId })
      ).rejects.toThrow();
    });

    it('should allow different guildIds', async () => {
      const config1 = await LevelConfigModel.create({ guildId: 'guild1' });
      const config2 = await LevelConfigModel.create({ guildId: 'guild2' });

      expect(config1.guildId).toBe('guild1');
      expect(config2.guildId).toBe('guild2');
      expect(config1._id).not.toEqual(config2._id);
    });
  });

  describe('Document Operations', () => {
    it('should create and save document successfully', async () => {
      const configData = {
        guildId: 'create-test',
        xpPerMsg: 8,
        xpPerMinVc: 12,
        cooldownSec: 30,
        notifyChannelId: 'notify-channel',
        levelUpMessage: 'Level up!',
        rewardMessage: 'Role reward!',
        roleRewards: [
          { level: 5, roleId: 'role5' },
          { level: 10, roleId: 'role10', rewardMessage: 'Special role!' }
        ]
      };

      const config = await LevelConfigModel.create(configData);

      expect(config.guildId).toBe('create-test');
      expect(config.xpPerMsg).toBe(8);
      expect(config.xpPerMinVc).toBe(12);
      expect(config.cooldownSec).toBe(30);
      expect(config.notifyChannelId).toBe('notify-channel');
      expect(config.levelUpMessage).toBe('Level up!');
      expect(config.rewardMessage).toBe('Role reward!');
      expect(config.roleRewards).toHaveLength(2);
    });

    it('should update document successfully', async () => {
      const config = await LevelConfigModel.create({
        guildId: 'update-test',
        xpPerMsg: 5
      });

      config.xpPerMsg = 15;
      config.cooldownSec = 60;
      config.roleRewards.push({ level: 20, roleId: 'newrole' });

      const savedConfig = await config.save();

      expect(savedConfig.xpPerMsg).toBe(15);
      expect(savedConfig.cooldownSec).toBe(60);
      expect(savedConfig.roleRewards).toHaveLength(1);
      expect(savedConfig.roleRewards[0].level).toBe(20);
    });

    it('should find documents by guildId', async () => {
      await LevelConfigModel.create({ guildId: 'find-test-1', xpPerMsg: 7 });
      await LevelConfigModel.create({ guildId: 'find-test-2', xpPerMsg: 9 });

      const config1 = await LevelConfigModel.findOne({ guildId: 'find-test-1' });
      const config2 = await LevelConfigModel.findOne({ guildId: 'find-test-2' });

      expect(config1).toBeDefined();
      expect(config2).toBeDefined();
      expect(config1?.xpPerMsg).toBe(7);
      expect(config2?.xpPerMsg).toBe(9);
    });

    it('should delete document successfully', async () => {
      const config = await LevelConfigModel.create({ guildId: 'delete-test' });
      const configId = config._id;

      await LevelConfigModel.findByIdAndDelete(configId);

      const deletedConfig = await LevelConfigModel.findById(configId);
      expect(deletedConfig).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors properly', async () => {
      try {
        await LevelConfigModel.create({
          guildId: 'validation-error',
          xpPerMsg: -5,
          cooldownSec: -10
        });
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.name).toBe('ValidationError');
        expect(error.errors).toBeDefined();
        expect(error.errors.xpPerMsg).toBeDefined();
        expect(error.errors.cooldownSec).toBeDefined();
      }
    });

    it('should handle duplicate key errors properly', async () => {
      const guildId = 'duplicate-error-test';
      await LevelConfigModel.create({ guildId });

      try {
        await LevelConfigModel.create({ guildId });
        fail('Should have thrown duplicate key error');
      } catch (error: any) {
        expect(error.code).toBe(11000); // MongoDB duplicate key error code
      }
    });

    it('should handle invalid data types gracefully', async () => {
      await expect(
        LevelConfigModel.create({
          guildId: 'invalid-types',
          xpPerMsg: 'not-a-number' as any,
          cooldownSec: 'also-not-a-number' as any
        })
      ).rejects.toThrow();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple roleRewards with validation', async () => {
      const config = new LevelConfigModel({
        guildId: 'complex-rewards'
      });

      // Add valid rewards
      config.roleRewards.push({ level: 5, roleId: 'bronze' });
      config.roleRewards.push({ level: 10, roleId: 'silver', rewardMessage: 'Silver achieved!' });
      config.roleRewards.push({ level: 25, roleId: 'gold' });

      await config.save();

      const saved = await LevelConfigModel.findOne({ guildId: 'complex-rewards' });
      expect(saved?.roleRewards).toHaveLength(3);
      expect(saved?.roleRewards[1].rewardMessage).toBe('Silver achieved!');
    });

    it('should maintain data integrity after multiple updates', async () => {
      const config = await LevelConfigModel.create({
        guildId: 'integrity-test',
        xpPerMsg: 1
      });

      // Update 1: Change XP values
      config.xpPerMsg = 3;
      config.xpPerMinVc = 6;
      await config.save();

      // Update 2: Add role rewards
      config.roleRewards.push({ level: 5, roleId: 'reward1' });
      await config.save();

      // Update 3: Modify messages
      config.levelUpMessage = 'Updated level message';
      config.rewardMessage = 'Updated reward message';
      await config.save();

      const final = await LevelConfigModel.findOne({ guildId: 'integrity-test' });
      expect(final?.xpPerMsg).toBe(3);
      expect(final?.xpPerMinVc).toBe(6);
      expect(final?.roleRewards).toHaveLength(1);
      expect(final?.levelUpMessage).toBe('Updated level message');
      expect(final?.rewardMessage).toBe('Updated reward message');
    });

    it('should properly serialize and deserialize complex data', async () => {
      const configData = {
        guildId: 'serialization-test',
        xpPerMsg: 7,
        xpPerMinVc: 14,
        cooldownSec: 120,
        notifyChannelId: 'channel-serialize',
        levelUpMessage: 'Congrats {user} on level {level}!',
        rewardMessage: 'New role {roleId} for {user}!',
        roleRewards: [
          { level: 3, roleId: 'role3', rewardMessage: 'Bronze tier!' },
          { level: 7, roleId: 'role7' },
          { level: 15, roleId: 'role15', rewardMessage: 'Gold tier!' }
        ]
      };

      const created = await LevelConfigModel.create(configData);
      const retrieved = await LevelConfigModel.findById(created._id);

      expect(retrieved?.toObject()).toMatchObject(
        expect.objectContaining({
          guildId: 'serialization-test',
          xpPerMsg: 7,
          xpPerMinVc: 14,
          cooldownSec: 120,
          notifyChannelId: 'channel-serialize',
          levelUpMessage: 'Congrats {user} on level {level}!',
          rewardMessage: 'New role {roleId} for {user}!',
          roleRewards: expect.arrayContaining([
            expect.objectContaining({ level: 3, roleId: 'role3', rewardMessage: 'Bronze tier!' }),
            expect.objectContaining({ level: 7, roleId: 'role7', rewardMessage: '' }),
            expect.objectContaining({ level: 15, roleId: 'role15', rewardMessage: 'Gold tier!' })
          ])
        })
      );
    });
  });
});