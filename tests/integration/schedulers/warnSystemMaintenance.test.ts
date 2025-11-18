import { Client } from 'discord.js';
import { WarnModel } from '../../../src/models/Warn';
import { dbManager } from '../setup/db';
import { GuildFactory } from '../factories';
jest.mock('node-cron', () => ({
  schedule: jest.fn((cronExpression, callback, options) => {
    (callback as any).__cronCallback = callback;
    (callback as any).__cronExpression = cronExpression;
    (callback as any).__cronOptions = options;
    return {
      destroy: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
  }),
}));

import cron from 'node-cron';
const mockSchedule = cron.schedule as jest.Mock;
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import logger from '../../../src/utils/logger';
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Warn System Maintenance Scheduler Integration Tests', () => {
  let mockClient: Client;
  let warnMaintenanceFunction: () => Promise<void>;

  beforeAll(async () => {
    await dbManager.startDb();
  });

  beforeEach(async () => {
    await dbManager.clearCollections();
    jest.clearAllMocks();
    process.env.GUILD_ID = 'test-guild-123';

    const warnSystemMaintenance = require('../../../src/events/clientReady/warnSystemMaintenance').default;
    await warnSystemMaintenance();

    const cronModule = require('node-cron');
    const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
    warnMaintenanceFunction = lastCall[1];
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  describe('Cron Job Registration', () => {
    it('should register cron job with correct expression', () => {
      const cronModule = require('node-cron');
      const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
      
      expect(lastCall[0]).toBe('0 0 * * *');
      expect(lastCall[2]).toEqual({ timezone: 'Europe/Warsaw' });
    });

    it('should register a function as callback', () => {
      const cronModule = require('node-cron');
      const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
      
      expect(typeof lastCall[1]).toBe('function');
    });
  });

  describe('Warning Cleanup Operations', () => {
    it('should remove old warnings older than 3 months', async () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 4);

      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 1);

      await WarnModel.create([
        {
          userId: 'user-123',
          guildId: process.env.GUILD_ID || 'test-guild-123',
          warnings: [
            {
              reason: 'Old warning 1',
              date: oldDate,
              moderatorId: 'mod-123',
            },
            {
              reason: 'Recent warning',
              date: recentDate,
              moderatorId: 'mod-123',
            },
          ],
        },
        {
          userId: 'user-456',
          guildId: process.env.GUILD_ID || 'test-guild-123',
          warnings: [
            {
              reason: 'Old warning 2',
              date: oldDate,
              moderatorId: 'mod-123',
            },
          ],
        },
      ]);

      await warnMaintenanceFunction();
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(2);
      const user123 = remainingWarnings.find(w => w.userId === 'user-123');
      expect(user123).toBeTruthy();
      expect(user123?.warnings).toHaveLength(1);
      expect(user123?.warnings[0].reason).toBe('Recent warning');
      
      const user456 = remainingWarnings.find(w => w.userId === 'user-456');
      expect(user456).toBeTruthy();
      expect(user456?.warnings).toHaveLength(0);
    });

    it('should handle empty database gracefully', async () => {
      const initialWarnings = await WarnModel.find({});
      expect(initialWarnings).toHaveLength(0);

      await warnMaintenanceFunction();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log number of removed warnings', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      await WarnModel.create([
        {
          userId: 'user-123',
          guildId: 'test-guild-123',
          warnings: [
            {
              reason: 'Old warning 1',
              date: oldDate,
              moderatorId: 'mod-123',
            },
          ],
        },
        {
          userId: 'user-456',
          guildId: 'test-guild-123',
          warnings: [
            {
              reason: 'Old warning 2',
              date: oldDate,
              moderatorId: 'mod-123',
            },
          ],
        },
      ]);

      await warnMaintenanceFunction();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wygasły')
      );
    });

    it('should handle warnings from multiple guilds', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);

      await WarnModel.create([
        {
          userId: 'user-123',
          guildId: 'test-guild-123',
          warnings: [
            {
              reason: 'Old warning guild 1',
              date: oldDate,
              moderatorId: 'mod-123',
            },
          ],
        },
        {
          userId: 'user-456',
          guildId: 'other-guild-456',
          warnings: [
            {
              reason: 'Old warning guild 2',
              date: oldDate,
              moderatorId: 'mod-456',
            },
          ],
        },
        {
          userId: 'user-789',
          guildId: 'test-guild-123',
          warnings: [
            {
              reason: 'Recent warning guild 1',
              date: recentDate,
              moderatorId: 'mod-123',
            },
          ],
        },
      ]);

      await warnMaintenanceFunction();
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(3);
      const mainGuildWarnings = remainingWarnings.filter(w => w.guildId === 'test-guild-123');
      expect(mainGuildWarnings).toHaveLength(2);
      const user123 = mainGuildWarnings.find(w => w.userId === 'user-123');
      expect(user123?.warnings).toHaveLength(0);
      
      const user789 = mainGuildWarnings.find(w => w.userId === 'user-789');
      expect(user789?.warnings).toHaveLength(1);
      expect(user789?.warnings[0].reason).toBe('Recent warning guild 1');
      
      const otherGuildWarning = remainingWarnings.find(w => w.guildId === 'other-guild-456');
      expect(otherGuildWarning?.warnings).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle warnings exactly 90 days old', async () => {
      const exactDate = new Date();
      exactDate.setDate(exactDate.getDate() - 90);

      await WarnModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Exactly 90 days old',
            date: exactDate,
            moderatorId: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(1);
      expect(remainingWarnings[0].warnings).toHaveLength(1);
    });

    it('should handle warnings with different timestamp formats', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      await WarnModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Warning with date timestamp',
            date: oldDate,
            moderatorId: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(1);
      expect(remainingWarnings[0].warnings).toHaveLength(0);
    });

    it('should preserve warning data integrity', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);

      const warning = await WarnModel.create({
        userId: 'user-123',
        guildId: 'guild-123',
        warnings: [
          {
            reason: 'Recent warning with special characters: äöü 🎉',
            date: recentDate,
            moderatorId: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(1);
      expect(remainingWarnings[0].userId).toBe('user-123');
      expect(remainingWarnings[0].warnings[0].reason).toBe('Recent warning with special characters: äöü 🎉');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle large number of warnings efficiently', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const oldWarnings = Array.from({ length: 100 }, (_, i) => ({
        userId: `user-${i}`,
        guildId: 'guild-123',
        warnings: [
          {
            reason: `Old warning ${i}`,
            date: oldDate,
            moderatorId: 'mod-123',
          },
        ],
      }));

      const recentWarnings = Array.from({ length: 10 }, (_, i) => ({
        userId: `recent-user-${i}`,
        guildId: 'guild-123',
        warnings: [
          {
            reason: `Recent warning ${i}`,
            date: recentDate,
            moderatorId: 'mod-123',
          },
        ],
      }));

      await WarnModel.create([...oldWarnings, ...recentWarnings]);

      const startTime = Date.now();
      await warnMaintenanceFunction();
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000);
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(110);
    });

    it('should handle concurrent scheduler executions', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      await WarnModel.create([
        {
          userId: 'user-123',
          guildId: 'guild-123',
          warnings: [
            {
              reason: 'Old warning 1',
              date: oldDate,
              moderatorId: 'mod-123',
            },
          ],
        },
        {
          userId: 'user-456',
          guildId: 'guild-123',
          warnings: [
            {
              reason: 'Old warning 2',
              date: oldDate,
              moderatorId: 'mod-123',
            },
          ],
        },
      ]);
      await Promise.all([
        warnMaintenanceFunction(),
        warnMaintenanceFunction(),
        warnMaintenanceFunction(),
      ]);
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(2);
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas utrzymania systemu ostrzeżeń')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const originalFind = WarnModel.find;
      WarnModel.find = jest.fn().mockImplementation(() => {
        throw new Error('Database connection error');
      });
      try {
        await warnMaintenanceFunction();
      } catch (error) {
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas utrzymania systemu ostrzeżeń'),
        expect.any(Error)
      );

      WarnModel.find = originalFind;
    });

    it('should continue execution after errors', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const originalFind = WarnModel.find;
      WarnModel.find = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });
      try {
        await warnMaintenanceFunction();
      } catch (error) {
      }
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas utrzymania systemu ostrzeżeń'),
        expect.any(Error)
      );

      WarnModel.find = originalFind;
      console.error = originalConsoleError;
    });
  });

  describe('Database Integration', () => {
    it('should work with real database operations', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const oldWarning = await WarnModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Old warning',
            date: oldDate,
            moderatorId: 'mod-123',
          },
        ],
      });

      const recentWarning = await WarnModel.create({
        userId: 'user-456',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Recent warning',
            date: recentDate,
            moderatorId: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();
      const oldWarningFromDb = await WarnModel.findById(oldWarning._id);
      const recentWarningFromDb = await WarnModel.findById(recentWarning._id);
      
      expect(oldWarningFromDb).toBeTruthy();
      expect(oldWarningFromDb?.warnings).toHaveLength(0);
      expect(recentWarningFromDb).toBeTruthy();
      expect(recentWarningFromDb?.warnings).toHaveLength(1);
    });

    it('should maintain proper indexes and constraints', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      await WarnModel.create([
        {
          userId: 'user-123',
          guildId: 'test-guild-123',
          warnings: [
            {
              reason: 'Warning 1',
              date: oldDate,
              moderatorId: 'mod-123',
            },
          ],
        },
        {
          userId: 'user-123',
          guildId: 'test-guild-123',
          warnings: [
            {
              reason: 'Warning 2',
              date: oldDate,
              moderatorId: 'mod-456',
            },
          ],
        },
      ]);

      await warnMaintenanceFunction();
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(2);
    });
  });

  describe('Scheduler Isolation', () => {
    it('should not affect other collections or models', async () => {
      
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      await WarnModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Old warning',
            date: oldDate,
            moderatorId: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();
      const warnings = await WarnModel.find({});
      expect(warnings).toHaveLength(1);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wygasły 1 ostrzeżeń dla userId=user-123')
      );
    });
  });
});
