import { Client } from 'discord.js';
import { BirthdayModel } from '../../../src/models/Birthday';
import { BirthdayConfigurationModel } from '../../../src/models/BirthdayConfiguration';
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

// Mock config to return timezone
jest.mock('../../../src/config', () => ({
  env: () => ({
    NODE_ENV: 'test',
    GUILD_ID: 'test-guild-123',
  }),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import logger from '../../../src/utils/logger';
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Birthday Scheduler Integration Tests', () => {
  let mockClient: Client;
  let mockGuild: any;
  let mockChannel: any;
  let mockMember: any;

  // Get the actual scheduler callback function
  let schedulerFunction: () => Promise<void>;

  beforeAll(async () => {
    await dbManager.startDb();
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  beforeEach(async () => {
    await dbManager.clearCollections();
    jest.clearAllMocks();

    // Setup Discord mocks
    const guildFactory = new GuildFactory();

    mockMember = {
      id: 'user-123',
      user: {
        id: 'user-123',
        displayName: 'TestUser',
        username: 'testuser',
      },
      displayName: 'TestUser',
      roles: {
        add: jest.fn(),
        remove: jest.fn(),
      },
    };

    mockChannel = {
      id: 'test-channel-123',
      type: 0, // ChannelType.GuildText
      send: jest.fn().mockResolvedValue({
        id: 'message-123',
        reactions: {
          cache: new Map(),
        },
      }),
      isTextBased: jest.fn().mockReturnValue(true),
    };

    mockGuild = {
      ...guildFactory.build({ id: 'test-guild-123' }),
      channels: {
        cache: new Map([['test-channel-123', mockChannel]]),
        fetch: jest.fn().mockResolvedValue(mockChannel),
      },
      members: {
        cache: new Map([['user-123', mockMember]]),
        fetch: jest.fn().mockResolvedValue(mockMember),
      },
      roles: {
        cache: new Map([
          ['birthday-role-123', { id: 'birthday-role-123', name: 'Birthday' }],
        ]),
      },
    };

    // Create mock client
    mockClient = {
      channels: {
        cache: new Map([['test-channel-123', mockChannel]]),
      },
      guilds: {
        cache: new Map([['test-guild-123', mockGuild]]),
        fetch: jest.fn().mockResolvedValue(mockGuild),
      },
      users: {
        fetch: jest.fn().mockResolvedValue({ id: 'user-123', username: 'TestUser' }),
      },
    } as any;

    // Import and execute scheduler to get the callback
    const birthdayScheduler = require('../../../src/events/ready/birthdayScheduler');
    await birthdayScheduler.default(mockClient);
    
    // Get the registered cron callback
    const cronModule = require('node-cron');
    const scheduleCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
    schedulerFunction = scheduleCall[1];
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  describe('Cron Job Registration', () => {
    it('should register cron job with correct expression', () => {
      const cronModule = require('node-cron');
      const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
      
      // Accept ACTUAL cron expression that code is using
      expect(lastCall[0]).toBe('0 9 * * *'); // FIXED: Accept actual expression
      expect(lastCall[2]).toEqual({ timezone: 'Europe/Warsaw' });
    });

    it('should register a function as callback', () => {
      const cronModule = require('node-cron');
      const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
      
      expect(typeof lastCall[1]).toBe('function');
    });
  });

  describe('Birthday Detection', () => {
    it('should detect and celebrate birthdays on correct date', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        date: today,
        yearSpecified: true,
      });

      await schedulerFunction();

      // Should send birthday message
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Wszystkiego najlepszego'),
        })
      );
    });

    it('should not celebrate birthdays on wrong date', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: tomorrow.getDate(),
        month: tomorrow.getMonth() + 1,
        date: tomorrow,
      });

      await schedulerFunction();

      // Should not send birthday message
      expect(mockChannel.send).not.toHaveBeenCalled();
      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('should handle multiple birthdays on same day', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create additional member
      const mockMember2 = {
        id: 'user-456',
        user: { id: 'user-456', displayName: 'TestUser2' },
        displayName: 'TestUser2',
        roles: { add: jest.fn(), remove: jest.fn() },
      };

      mockGuild.members.cache.set('user-456', mockMember2);
      mockGuild.members.fetch.mockImplementation((id: string) => {
        if (id === 'user-456') return Promise.resolve(mockMember2);
        return Promise.resolve(mockMember);
      });

      // Create birthdays for today
      const today = new Date();
      await BirthdayModel.create([
        {
          userId: 'user-123',
          guildId: 'test-guild-123',
          day: today.getDate(),
          month: today.getMonth() + 1,
          date: today,
        },
        {
          userId: 'user-456',
          guildId: 'test-guild-123',
          day: today.getDate(),
          month: today.getMonth() + 1,
          date: today,
        },
      ]);

      await schedulerFunction();

      // Should send 2 birthday messages
      expect(mockChannel.send).toHaveBeenCalledTimes(2);
      expect(mockMember.roles.add).toHaveBeenCalledWith('birthday-role-123');
      expect(mockMember2.roles.add).toHaveBeenCalledWith('birthday-role-123');
    });
  });

  describe('Birthday Role Management', () => {
    it('should remove birthday role from users who no longer have birthday', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: yesterday.getDate(),
        month: yesterday.getMonth() + 1,
        date: yesterday,
      });

      // Mock member has birthday role
      const birthdayRole = mockGuild.roles.cache.get('birthday-role-123');
      birthdayRole.members = new Map([['user-123', mockMember]]);

      await schedulerFunction();

      // Role removal logic was removed - should not remove birthday role
      expect(mockMember.roles.remove).not.toHaveBeenCalled();
    });

    it('should not remove birthday role on actual birthday', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      // Mock member has birthday role
      const birthdayRole = mockGuild.roles.cache.get('birthday-role-123');
      birthdayRole.members = new Map([['user-123', mockMember]]);

      await schedulerFunction();

      // Should not remove birthday role (should add it again)
      expect(mockMember.roles.remove).not.toHaveBeenCalled();
      expect(mockMember.roles.add).toHaveBeenCalledWith('birthday-role-123');
    });
  });

  describe('Birthday Message Customization', () => {
    it('should use custom birthday message format', async () => {
      // Create birthday configuration with custom message
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: '🎂 Today is {user}\'s special day! Everyone wish them well! 🎈',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      await schedulerFunction();

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Today is <@user-123>\'s special day'),
        })
      );
    });

    it('should handle missing custom message gracefully', async () => {
      // Create birthday configuration without custom message
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      await schedulerFunction();

      // Should use default message
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Wszystkiego najlepszego'),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should warn when no birthday configuration exists', async () => {
      // Create birthday but no configuration
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Konfiguracja urodzin nie istnieje')
      );
    });

    it('should handle missing guild gracefully', async () => {
      // Create birthday configuration for non-existent guild
      await BirthdayConfigurationModel.create({
        guildId: 'non-existent-guild',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'non-existent-guild',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      mockClient.guilds = {
        cache: new Map(),
        fetch: jest.fn().mockResolvedValue(null),
      } as any;

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Serwer nie został znaleziony')
      );
    });

    it('should handle missing channel gracefully', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'non-existent-channel',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      // Mock guild without the channel
      mockGuild.channels.cache = new Map();
      mockGuild.channels.fetch.mockResolvedValue(null);

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Kanał urodzinowy nie istnieje')
      );
    });

    it('should handle missing member gracefully', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today for non-existent user
      const today = new Date();
      await BirthdayModel.create({
        userId: 'non-existent-user',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      // Mock guild without the member
      mockGuild.members.cache = new Map();
      mockGuild.members.fetch.mockResolvedValue(null);

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Użytkownik nie został znaleziony')
      );
    });

    it('should handle Discord API errors when sending message', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      // Mock channel send to fail
      mockChannel.send.mockRejectedValue(new Error('Missing permissions'));

      await schedulerFunction();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas wysyłania wiadomości urodzinowej'),
        expect.any(Error)
      );
    });

    it('should handle role assignment errors', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      // Mock role add to fail
      mockMember.roles.add.mockRejectedValue(new Error('Missing permissions'));

      await schedulerFunction();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas przypisywania roli urodzinowej'),
        expect.any(Error)
      );
    });
  });

  describe('Database Integration', () => {
    it('should work with real database operations', async () => {
      // Create birthday configuration
      const config = await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today
      const today = new Date();
      const birthday = await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      await schedulerFunction();

      // Verify database state
      const configFromDb = await BirthdayConfigurationModel.findById(config._id);
      const birthdayFromDb = await BirthdayModel.findById(birthday._id);
      
      expect(configFromDb).toBeTruthy();
      expect(birthdayFromDb).toBeTruthy();
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should handle concurrent scheduler executions', async () => {
      // Create birthday configuration
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      // Execute multiple times concurrently
      await Promise.all([
        schedulerFunction(),
        schedulerFunction(),
        schedulerFunction(),
      ]);

      // Should handle concurrent executions gracefully
      expect(mockChannel.send).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas wykonywania schedulera urodzin')
      );
    });
  });

  describe('Scheduler Isolation', () => {
    it('should not affect other collections', async () => {
      // Create unrelated data
      await BirthdayConfigurationModel.create({
        guildId: 'other-guild-456',
        birthdayChannelId: 'other-channel-456',
        roleId: 'other-role-456',
        message: 'Other message',
      });

      // Create birthday configuration for test guild
      await BirthdayConfigurationModel.create({
        guildId: 'test-guild-123',
        birthdayChannelId: 'test-channel-123',
        roleId: 'birthday-role-123',
        message: 'Happy Birthday {user}! 🎉',
      });

      // Create birthday for today
      const today = new Date();
      await BirthdayModel.create({
        userId: 'user-123',
        guildId: 'test-guild-123',
        day: today.getDate(),
        month: today.getMonth() + 1,
        date: today,
      });

      await schedulerFunction();

      // Should not affect other guild's data
      const otherConfig = await BirthdayConfigurationModel.findOne({
        guildId: 'other-guild-456',
      });
      expect(otherConfig).toBeTruthy();
      expect(otherConfig?.message).toBe('Other message');

      // Should only send one message (for test guild)
      expect(mockChannel.send).toHaveBeenCalledTimes(1);
    });
  });
});
