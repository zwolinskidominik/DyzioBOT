import { Client } from 'discord.js';
import { QuestionConfigurationModel } from '../../../src/models/QuestionConfiguration';
import { QuestionModel } from '../../../src/models/Question';
import { dbManager } from '../setup/db';
import { GuildFactory } from '../factories';
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import logger from '../../../src/utils/logger';
const mockLogger = logger as jest.Mocked<typeof logger>;
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
jest.mock('../../../src/config', () => ({
  env: () => ({
    GUILD_ID: 'test-guild-123',
  }),
}));

describe('Question Scheduler Integration Tests', () => {
  let mockClient: Client;
  let mockGuild: any;
  let mockChannel: any;
  let mockMessage: any;
  let mockThread: any;
  let schedulerFunction: any;

  beforeAll(async () => {
    await dbManager.startDb();
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  beforeEach(async () => {
    await dbManager.clearCollections();
    jest.clearAllMocks();

    const guildFactory = new GuildFactory();
    
    mockMessage = {
      id: 'test-message-123',
      react: jest.fn().mockResolvedValue({}),
    };

    mockThread = {
      id: 'test-thread-123',
      name: 'Test Thread',
    };

    mockChannel = {
      id: 'test-channel-123',
      type: 0,
      send: jest.fn().mockResolvedValue(mockMessage),
      threads: {
        create: jest.fn().mockResolvedValue(mockThread),
      },
    };

    mockGuild = guildFactory.create({
      id: 'test-guild-123',
      name: 'Test Guild',
    });

    mockClient = {
      channels: {
        cache: new Map([['test-channel-123', mockChannel]]),
      },
      guilds: {
        cache: new Map([['test-guild-123', mockGuild]]),
      },
    } as any;

    const questionScheduler = require('../../../src/events/ready/questionScheduler');
    await questionScheduler.default(mockClient);
    const cronModule = require('node-cron');
    const scheduleCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
    schedulerFunction = scheduleCall[1];
  });

  describe('Cron Job Registration', () => {
    it('should register cron job with correct expression', () => {
      const cronModule = require('node-cron');
      const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
      
      expect(lastCall[0]).toBe('0 0 10 * * *');
      expect(lastCall[2]).toEqual({
        timezone: 'Europe/Warsaw',
      });
    });

    it('should register a function as callback', () => {
      const cronModule = require('node-cron');
      const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
      
      expect(typeof lastCall[1]).toBe('function');
    });
  });

  describe('Question Configuration Validation', () => {
    it('should log warning and return when no question configuration exists', async () => {
      
      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith('Konfiguracja kanału pytań nie istnieje!');
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should log warning when channel does not exist', async () => {
      await QuestionConfigurationModel.create({
        guildId: 'test-guild-123',
        questionChannelId: 'non-existent-channel',
        pingRoleId: null,
      });

      mockClient.channels.cache.clear();

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith('Kanał pytań nie istnieje lub nie jest tekstowy!');
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should log warning when channel is not a text channel', async () => {
      await QuestionConfigurationModel.create({
        guildId: 'test-guild-123',
        questionChannelId: 'test-channel-123',
        pingRoleId: null,
      });
      const voiceChannel = { id: 'test-channel-123', type: 2 };
      mockClient.channels.cache.set('test-channel-123', voiceChannel as any);

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith('Kanał pytań nie istnieje lub nie jest tekstowy!');
    });
  });

  describe('Question Selection and Posting', () => {
    beforeEach(async () => {
      await QuestionConfigurationModel.create({
        guildId: 'test-guild-123',
        questionChannelId: 'test-channel-123',
        pingRoleId: null,
      });
    });

    it('should send message and return when no questions exist', async () => {

      await schedulerFunction();

      expect(mockLogger.info).toHaveBeenCalledWith('Brak pytań w bazie danych!');
      expect(mockChannel.send).toHaveBeenCalledWith('Brak pytań w bazie danych!');
      expect(mockChannel.threads.create).not.toHaveBeenCalled();
    });

    it('should select random question and post it', async () => {
      const question = await QuestionModel.create({
        authorId: 'user-123',
        content: 'What is your favorite programming language?',
        reactions: ['👍', '👎'],
      });

      await schedulerFunction();

      expect(mockChannel.send).toHaveBeenCalledWith(
        '**Pytanie dnia:**\nWhat is your favorite programming language?'
      );
      expect(mockChannel.threads.create).toHaveBeenCalledWith({
        name: 'What is your favorite programming language?',
        autoArchiveDuration: 1440,
        type: 11,
        startMessage: mockMessage,
      });
    });

    it('should truncate long question content for thread name', async () => {
      const longContent = 'This is a very long question that exceeds 97 characters and should be truncated for the thread name to fit Discord limits';
      await QuestionModel.create({
        authorId: 'user-123',
        content: longContent,
        reactions: ['❓'],
      });

      await schedulerFunction();

      expect(mockChannel.threads.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: longContent.slice(0, 97) + '...',
        })
      );
    });

    it('should include ping role when configured', async () => {
      await QuestionConfigurationModel.findOneAndUpdate(
        { guildId: 'test-guild-123' },
        { pingRoleId: 'test-role-456' }
      );

      await QuestionModel.create({
        authorId: 'user-123',
        content: 'Test question',
        reactions: [],
      });

      await schedulerFunction();

      expect(mockChannel.send).toHaveBeenCalledWith(
        '<@&test-role-456>\n\n**Pytanie dnia:**\nTest question'
      );
    });

    it('should add reactions to the question message', async () => {
      await QuestionModel.create({
        authorId: 'user-123',
        content: 'Rate this feature',
        reactions: ['⭐', '❤️', '👍', '👎'],
      });

      await schedulerFunction();

      expect(mockMessage.react).toHaveBeenCalledTimes(4);
      expect(mockMessage.react).toHaveBeenCalledWith('⭐');
      expect(mockMessage.react).toHaveBeenCalledWith('❤️');
      expect(mockMessage.react).toHaveBeenCalledWith('👍');
      expect(mockMessage.react).toHaveBeenCalledWith('👎');
    });

    it('should handle reaction errors gracefully', async () => {
      await QuestionModel.create({
        authorId: 'user-123',
        content: 'Test question',
        reactions: ['❤️', '💔'],
      });
      mockMessage.react
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Invalid emoji'));

      await schedulerFunction();

      expect(mockMessage.react).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Błąd podczas dodawania reakcji "💔": Error: Invalid emoji'
      );
    });

    it('should delete question after posting', async () => {
      const question = await QuestionModel.create({
        authorId: 'user-123',
        content: 'Will be deleted',
        reactions: [],
      });

      expect(await QuestionModel.countDocuments()).toBe(1);

      await schedulerFunction();

      expect(await QuestionModel.countDocuments()).toBe(0);
      expect(await QuestionModel.findById(question._id)).toBeNull();
    });
  });

  describe('Multiple Questions Handling', () => {
    beforeEach(async () => {
      await QuestionConfigurationModel.create({
        guildId: 'test-guild-123',
        questionChannelId: 'test-channel-123',
        pingRoleId: null,
      });
    });

    it('should select one random question from multiple', async () => {
      await QuestionModel.create([
        { authorId: 'user-123', content: 'Question 1', reactions: [] },
        { authorId: 'user-123', content: 'Question 2', reactions: [] },
        { authorId: 'user-123', content: 'Question 3', reactions: [] },
      ]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await schedulerFunction();
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.stringMatching(/\*\*Pytanie dnia:\*\*\n(Question 1|Question 2|Question 3)/)
      );
      expect(await QuestionModel.countDocuments()).toBe(2);

      (Math.random as jest.Mock).mockRestore();
    });

    it('should handle random selection correctly', async () => {
      await QuestionModel.create([
        { authorId: 'user-123', content: 'First', reactions: [] },
        { authorId: 'user-123', content: 'Second', reactions: [] },
        { authorId: 'user-123', content: 'Third', reactions: [] },
      ]);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      await schedulerFunction();
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.stringMatching(/\*\*Pytanie dnia:\*\*\n(First|Second|Third)/)
      );

      (Math.random as jest.Mock).mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await QuestionConfigurationModel.create({
        guildId: 'test-guild-123',
        questionChannelId: 'test-channel-123',
        pingRoleId: null,
      });
    });

    it('should handle database query errors', async () => {
      jest.spyOn(QuestionConfigurationModel, 'findOne').mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await schedulerFunction();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Błąd wysyłania pytania dnia: Error: Database connection failed'
      );
    });

    it('should handle Discord API errors when sending message', async () => {
      await QuestionModel.create({
        authorId: 'user-123',
        content: 'Test question',
        reactions: [],
      });

      mockChannel.send.mockRejectedValueOnce(new Error('Missing permissions'));

      await schedulerFunction();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Błąd wysyłania pytania dnia: Error: Missing permissions'
      );
    });

    it('should handle thread creation errors', async () => {
      await QuestionModel.create({
        authorId: 'user-123',
        content: 'Test question',
        reactions: [],
      });

      mockChannel.threads.create.mockRejectedValueOnce(new Error('Thread creation failed'));

      await schedulerFunction();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Błąd wysyłania pytania dnia: Error: Thread creation failed'
      );
    });

    it('should continue execution after reaction errors', async () => {
      const question = await QuestionModel.create({
        authorId: 'user-123',
        content: 'Test question',
        reactions: ['❤️'],
      });

      mockMessage.react.mockRejectedValueOnce(new Error('Reaction failed'));

      await schedulerFunction();
      expect(await QuestionModel.findById(question._id)).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Błąd podczas dodawania reakcji "❤️": Error: Reaction failed'
      );
    });
  });

  describe('Database Integration', () => {
    it('should work with real database operations', async () => {
      await QuestionConfigurationModel.create({
        guildId: 'test-guild-123',
        questionChannelId: 'test-channel-123',
        pingRoleId: 'role-123',
      });

      const question = await QuestionModel.create({
        authorId: 'user-123',
        content: 'Database integration test',
        reactions: ['🎯'],
      });

      expect(await QuestionModel.countDocuments()).toBe(1);
      expect(await QuestionConfigurationModel.countDocuments()).toBe(1);

      await schedulerFunction();

      expect(await QuestionModel.countDocuments()).toBe(0);
      expect(await QuestionConfigurationModel.countDocuments()).toBe(1);
    });

    it('should handle concurrent scheduler executions', async () => {
      await QuestionConfigurationModel.create({
        guildId: 'test-guild-123',
        questionChannelId: 'test-channel-123',
        pingRoleId: null,
      });
      await QuestionModel.create([
        { authorId: 'user-123', content: 'Question A', reactions: [] },
        { authorId: 'user-123', content: 'Question B', reactions: [] },
      ]);
      const promises = [
        schedulerFunction(),
        schedulerFunction(),
        schedulerFunction(),
      ];

      await Promise.all(promises);
      expect(mockChannel.send).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('concurrent')
      );
    });
  });

  describe('Scheduler Isolation', () => {
    it('should not affect other collections', async () => {
      await QuestionConfigurationModel.create({
        guildId: 'other-guild',
        questionChannelId: 'other-channel',
        pingRoleId: null,
      });

      await QuestionConfigurationModel.create({
        guildId: 'test-guild-123',
        questionChannelId: 'test-channel-123',
        pingRoleId: null,
      });

      await QuestionModel.create({
        authorId: 'user-123',
        content: 'Test question',
        reactions: [],
      });

      const initialConfigCount = await QuestionConfigurationModel.countDocuments();
      expect(initialConfigCount).toBe(2);

      await schedulerFunction();
      expect(await QuestionConfigurationModel.countDocuments()).toBe(2);
      expect(await QuestionModel.countDocuments()).toBe(0);
    });
  });
});