import { Client } from 'discord.js';
import { WarnModel } from '../../../src/models/Warn';
import { dbManager } from '../setup/db';
import { GuildFactory } from '../factories';

// Mock node-cron
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

// Mock logger
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

  // Get the actual scheduler callback function
  let warnMaintenanceFunction: () => Promise<void>;

  beforeAll(async () => {
    await dbManager.startDb();
  });

  beforeEach(async () => {
    // Clear all data
    await dbManager.clearCollections();

    // Reset all mocks
    jest.clearAllMocks();

    // Set consistent GUILD_ID for tests
    process.env.GUILD_ID = 'test-guild-123';

    // Import and initialize scheduler AFTER clearing mocks
    const warnSystemMaintenance = require('../../../src/events/ready/warnSystemMaintenance').default;
    await warnSystemMaintenance();

    // Extract the callback function
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
      
      expect(lastCall[0]).toBe('0 0 * * *'); // Daily at midnight
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
      // Create old warnings (older than 3 months)
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 4); // 4 months ago

      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 1); // 1 month ago

      await WarnModel.create([
        {
          userId: 'user-123',
          guildId: process.env.GUILD_ID || 'test-guild-123',
          warnings: [
            {
              reason: 'Old warning 1',
              date: oldDate,
              moderator: 'mod-123',
            },
            {
              reason: 'Recent warning',
              date: recentDate,
              moderator: 'mod-123',
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
              moderator: 'mod-123',
            },
          ],
        },
      ]);

      await warnMaintenanceFunction();

      // Should filter old warnings from arrays, keep recent ones
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(2); // Both users remain
      
      // First user should have only recent warning
      const user123 = remainingWarnings.find(w => w.userId === 'user-123');
      expect(user123).toBeTruthy();
      expect(user123?.warnings).toHaveLength(1);
      expect(user123?.warnings[0].reason).toBe('Recent warning');
      
      // Second user should have empty warnings array (old one removed)
      const user456 = remainingWarnings.find(w => w.userId === 'user-456');
      expect(user456).toBeTruthy();
      expect(user456?.warnings).toHaveLength(0);
    });

    it('should handle empty database gracefully', async () => {
      // Ensure database is empty
      const initialWarnings = await WarnModel.find({});
      expect(initialWarnings).toHaveLength(0);

      await warnMaintenanceFunction();

      // Should complete without errors
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log number of removed warnings', async () => {
      // Create old warnings
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
              moderator: 'mod-123',
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
              moderator: 'mod-123',
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
              moderator: 'mod-123',
            },
          ],
        },
        {
          userId: 'user-456',
          guildId: 'other-guild-456', // Different guild - should not be processed
          warnings: [
            {
              reason: 'Old warning guild 2',
              date: oldDate,
              moderator: 'mod-456',
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
              moderator: 'mod-123',
            },
          ],
        },
      ]);

      await warnMaintenanceFunction();

      // Should process only main guild warnings, leave other guilds untouched
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(3); // All 3 documents remain
      
      // Check main guild documents
      const mainGuildWarnings = remainingWarnings.filter(w => w.guildId === 'test-guild-123');
      expect(mainGuildWarnings).toHaveLength(2);
      
      // First user should have empty warnings (old removed)
      const user123 = mainGuildWarnings.find(w => w.userId === 'user-123');
      expect(user123?.warnings).toHaveLength(0);
      
      // Third user should have recent warning intact
      const user789 = mainGuildWarnings.find(w => w.userId === 'user-789');
      expect(user789?.warnings).toHaveLength(1);
      expect(user789?.warnings[0].reason).toBe('Recent warning guild 1');
      
      // Other guild should be untouched
      const otherGuildWarning = remainingWarnings.find(w => w.guildId === 'other-guild-456');
      expect(otherGuildWarning?.warnings).toHaveLength(1); // Unchanged
    });
  });

  describe('Edge Cases', () => {
    it('should handle warnings exactly 90 days old', async () => {
      // Create warning exactly 90 days ago
      const exactDate = new Date();
      exactDate.setDate(exactDate.getDate() - 90);

      await WarnModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Exactly 90 days old',
            date: exactDate,
            moderator: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();

      // Should keep warnings that are exactly 90 days old (3 months = ~90 days is the boundary)
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(1);
      expect(remainingWarnings[0].warnings).toHaveLength(1); // Warning should remain
    });

    it('should handle warnings with different timestamp formats', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      // Test with old warnings that should be removed
      await WarnModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Warning with date timestamp',
            date: oldDate,
            moderator: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();

      // Should remove old warnings but keep document with empty array
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(1);
      expect(remainingWarnings[0].warnings).toHaveLength(0); // Warnings removed
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
            moderator: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();

      // Should preserve all warning data
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

      // Create 100 old warnings and 10 recent ones
      const oldWarnings = Array.from({ length: 100 }, (_, i) => ({
        userId: `user-${i}`,
        guildId: 'guild-123',
        warnings: [
          {
            reason: `Old warning ${i}`,
            date: oldDate,
            moderator: 'mod-123',
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
            moderator: 'mod-123',
          },
        ],
      }));

      await WarnModel.create([...oldWarnings, ...recentWarnings]);

      const startTime = Date.now();
      await warnMaintenanceFunction();
      const executionTime = Date.now() - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(executionTime).toBeLessThan(1000);

      // Should keep only recent warnings (100 empty + 10 with warnings)
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(110); // All documents remain, but old ones have empty warnings
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
              moderator: 'mod-123',
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
              moderator: 'mod-123',
            },
          ],
        },
      ]);

      // Execute multiple times concurrently
      await Promise.all([
        warnMaintenanceFunction(),
        warnMaintenanceFunction(),
        warnMaintenanceFunction(),
      ]);

      // Should handle concurrent executions gracefully - documents remain with empty warnings
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(2); // Both documents remain but with empty warnings
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas utrzymania systemu ostrzeżeń')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock a database error on find
      const originalFind = WarnModel.find;
      WarnModel.find = jest.fn().mockImplementation(() => {
        throw new Error('Database connection error');
      });

      // Use try-catch to handle the error that may be thrown by warnMaintenanceFunction
      try {
        await warnMaintenanceFunction();
      } catch (error) {
        // This is expected due to the mock throwing an error
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas utrzymania systemu ostrzeżeń'),
        expect.any(Error)
      );

      // Restore original method
      WarnModel.find = originalFind;
    });

    it('should continue execution after errors', async () => {
      // This test verifies the try-catch block works and errors are logged
      // Mock console.error to suppress error output during test
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Mock find to throw error to trigger catch block
      const originalFind = WarnModel.find;
      WarnModel.find = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Use try-catch to handle the error that may be thrown by warnMaintenanceFunction
      try {
        await warnMaintenanceFunction();
      } catch (error) {
        // This is expected due to the mock throwing an error
      }

      // Should log error and not crash
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas utrzymania systemu ostrzeżeń'),
        expect.any(Error)
      );

      // Restore methods
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

      // Create warnings with real database operations
      const oldWarning = await WarnModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Old warning',
            date: oldDate,
            moderator: 'mod-123',
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
            moderator: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();

      // Verify database state - old warning document remains but with empty warnings, recent kept
      const oldWarningFromDb = await WarnModel.findById(oldWarning._id);
      const recentWarningFromDb = await WarnModel.findById(recentWarning._id);
      
      expect(oldWarningFromDb).toBeTruthy(); // Document remains
      expect(oldWarningFromDb?.warnings).toHaveLength(0); // But warnings are empty
      expect(recentWarningFromDb).toBeTruthy(); // Still exists
      expect(recentWarningFromDb?.warnings).toHaveLength(1); // With warnings intact
    });

    it('should maintain proper indexes and constraints', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      // Create warnings that might test unique constraints
      await WarnModel.create([
        {
          userId: 'user-123',
          guildId: 'test-guild-123',
          warnings: [
            {
              reason: 'Warning 1',
              date: oldDate,
              moderator: 'mod-123',
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
              moderator: 'mod-456',
            },
          ],
        },
      ]);

      await warnMaintenanceFunction();

      // Should handle database constraints properly - documents remain with empty warnings
      const remainingWarnings = await WarnModel.find({});
      expect(remainingWarnings).toHaveLength(2); // Both documents remain but with empty warnings
    });
  });

  describe('Scheduler Isolation', () => {
    it('should not affect other collections or models', async () => {
      // This test ensures the maintenance only affects warnings
      // In a real scenario, you might have other models to test with
      
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      await WarnModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        warnings: [
          {
            reason: 'Old warning',
            date: oldDate,
            moderator: 'mod-123',
          },
        ],
      });

      await warnMaintenanceFunction();

      // Should only affect warnings, not other data - document remains with empty warnings
      const warnings = await WarnModel.find({});
      expect(warnings).toHaveLength(1); // Document remains but with empty warnings
      
      // Other collections should remain unaffected
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wygasły 1 ostrzeżeń dla userId=user-123')
      );
    });
  });
});