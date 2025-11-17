import { Client } from 'discord.js';
import { GiveawayModel } from '../../../src/models/Giveaway';
import { dbManager } from '../setup/db';
import { GuildFactory } from '../factories';
jest.unmock('discord.js');
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
jest.mock('../../../src/utils/giveawayHelpers', () => ({
  pickWinners: jest.fn(),
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn((options) => ({
    description: options.description,
    footer: { text: options.footerText },
    color: options.color,
  })),
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import logger from '../../../src/utils/logger';
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Giveaway Scheduler Integration Tests', () => {
  jest.setTimeout(20000);
  let mockClient: Client;
  let mockGuild: any;
  let mockChannel: any;
  let mockMessage: any;
  let schedulerFunction: any;
  let mockPickWinners: jest.Mock;

  beforeAll(async () => {
    await dbManager.startDb();
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  beforeEach(async () => {
    jest.unmock('discord.js');
    await dbManager.clearCollections();
    jest.clearAllMocks();

    mockPickWinners = require('../../../src/utils/giveawayHelpers').pickWinners;
    
    const guildFactory = new GuildFactory();
    
    mockMessage = {
      id: 'test-message-123',
      edit: jest.fn().mockResolvedValue({}),
    };

    mockChannel = {
      id: 'test-channel-123',
      type: 0,
      messages: {
        fetch: jest.fn().mockResolvedValue(mockMessage),
      },
      send: jest.fn().mockResolvedValue(mockMessage),
    };

    mockGuild = {
      id: 'test-guild-123',
      name: 'Test Guild',
      channels: {
        cache: new Map([['test-channel-123', mockChannel]]),
      },
      members: {
        cache: new Map(),
      },
    };

    mockClient = {
      guilds: {
        cache: new Map([['test-guild-123', mockGuild]]),
      },
    } as any;

  const giveawayScheduler = require('../../../src/events/ready/giveawayScheduler');
  await giveawayScheduler.default(mockClient);
    const cronModule = require('node-cron');
    const scheduleCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
    schedulerFunction = scheduleCall[1];
  });

  describe('Cron Job Registration', () => {
    it('should register cron job with correct expression', () => {
      const cronModule = require('node-cron');
      const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
      
      expect(lastCall[0]).toBe('* * * * *');
      expect(lastCall[2]).toEqual({ timezone: 'Europe/Warsaw' });
    });

    it('should register a function as callback', () => {
      const cronModule = require('node-cron');
      const lastCall = cronModule.schedule.mock.calls[cronModule.schedule.mock.calls.length - 1];
      
      expect(typeof lastCall[1]).toBe('function');
    });
  });

  describe('Giveaway Scanning', () => {
    it('should not process anything when no expired giveaways exist', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: futureDate,
        winnersCount: 1,
        participants: [],
        active: true,
        finalized: false,
      });

      await schedulerFunction();

      expect(mockChannel.messages.fetch).not.toHaveBeenCalled();
      expect(mockMessage.edit).not.toHaveBeenCalled();
    });

    it('should scan and process expired giveaways', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: ['user1', 'user2'],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([{ id: 'user1', tag: 'User1#1234' }]);

      await schedulerFunction();

      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('test-message-123');
      expect(mockMessage.edit).toHaveBeenCalled();
    });

    it('should process multiple expired giveaways in order', async () => {
      const pastDate1 = new Date(Date.now() - 7200000);
      const pastDate2 = new Date(Date.now() - 3600000);

      await GiveawayModel.create([
        {
          giveawayId: 'giveaway-older',
          guildId: 'test-guild-123',
          channelId: 'test-channel-123',
          messageId: 'message-older',
          hostId: 'test-host-123',
          prize: 'Older Prize',
          description: 'Older Description',
          endTime: pastDate1,
          winnersCount: 1,
          participants: [],
          active: true,
          finalized: false,
        },
        {
          giveawayId: 'giveaway-newer',
          guildId: 'test-guild-123',
          channelId: 'test-channel-123',
          messageId: 'message-newer',
          hostId: 'test-host-123',
          prize: 'Newer Prize',
          description: 'Newer Description',
          endTime: pastDate2,
          winnersCount: 1,
          participants: [],
          active: true,
          finalized: false,
        },
      ]);

      mockPickWinners.mockResolvedValue([]);
      mockChannel.messages.fetch
        .mockResolvedValueOnce({ id: 'message-older', edit: jest.fn() })
        .mockResolvedValueOnce({ id: 'message-newer', edit: jest.fn() });

      await schedulerFunction();
      expect(mockChannel.messages.fetch).toHaveBeenCalledTimes(2);
      expect(mockChannel.messages.fetch).toHaveBeenNthCalledWith(1, 'message-older');
      expect(mockChannel.messages.fetch).toHaveBeenNthCalledWith(2, 'message-newer');
    });
  });

  describe('Giveaway State Management', () => {
    it('should set giveaway to inactive when processing', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      const giveaway = await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: [],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([]);

      await schedulerFunction();

      const updatedGiveaway = await GiveawayModel.findById(giveaway._id);
      expect(updatedGiveaway?.active).toBe(false);
    });

    it('should mark giveaway as finalized after processing', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      const giveaway = await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: [],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([]);

      await schedulerFunction();

      const updatedGiveaway = await GiveawayModel.findById(giveaway._id);
      expect(updatedGiveaway?.finalized).toBe(true);
    });
  });

  describe('Winner Selection', () => {
    it('should pick winners and display them correctly', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 2,
        participants: ['user1', 'user2', 'user3'],
        active: true,
        finalized: false,
      });

      const mockWinners = [
        { id: 'user1', tag: 'User1#1234' },
        { id: 'user2', tag: 'User2#5678' },
      ];
      mockPickWinners.mockResolvedValue(mockWinners);

      await schedulerFunction();

      expect(mockPickWinners).toHaveBeenCalledWith(['user1', 'user2', 'user3'], 2, mockGuild);

      const createBaseEmbed = require('../../../src/utils/embedHelpers').createBaseEmbed;
      const embedCall = createBaseEmbed.mock.calls[0][0];
      expect(embedCall.description).toContain('<@user1>, <@user2>');
    });

    it('should handle no winners scenario', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: [],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([]);

      await schedulerFunction();

      const createBaseEmbed = require('../../../src/utils/embedHelpers').createBaseEmbed;
      const embedCall = createBaseEmbed.mock.calls[0][0];
      expect(embedCall.description).toContain('Brak zwycięzców');
    });

    it('should warn when no winners despite having participants', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: ['user1', 'user2'],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([]);

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Brak zwycięzców mimo uczestników')
      );
    });
  });

  describe('Discord Integration', () => {
    it('should update giveaway message with correct embed', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Amazing Prize',
        description: 'Amazing Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: ['user1'],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([{ id: 'user1', tag: 'User1#1234' }]);

      await schedulerFunction();

      expect(mockMessage.edit).toHaveBeenCalledWith({
        embeds: [expect.any(Object)],
        components: [],
      });

      const createBaseEmbed = require('../../../src/utils/embedHelpers').createBaseEmbed;
      const embedCall = createBaseEmbed.mock.calls[0][0];
      expect(embedCall.description).toContain('Amazing Prize');
      expect(embedCall.description).toContain('Amazing Description');
      expect(embedCall.description).toContain('<@test-host-123>');
      expect(embedCall.footerText).toBe('Giveaway ID: test-giveaway-1');
    });

    it('should send winner announcement message', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: ['user1'],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([{ id: 'user1', tag: 'User1#1234' }]);

      await schedulerFunction();

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('🎉 Gratulacje <@user1>')
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should continue processing when guild not found', async () => {
      mockClient.guilds.cache.get = jest.fn().mockReturnValue(undefined);

      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'non-existent-guild',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: [],
        active: true,
        finalized: false,
      });

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Nie znaleziono serwera o ID: non-existent-guild')
      );
    });

    it('should continue processing when channel not found', async () => {
      mockGuild.channels.cache.get = jest.fn().mockReturnValue(undefined);

      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'non-existent-channel',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: [],
        active: true,
        finalized: false,
      });

      await schedulerFunction();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Nie znaleziono kanału o ID: non-existent-channel')
      );
    });

    it('should handle message fetch failures', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'non-existent-message',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: [],
        active: true,
        finalized: false,
      });

      mockChannel.messages.fetch.mockRejectedValueOnce(new Error('Message not found'));

      await schedulerFunction();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Nie można pobrać wiadomości giveaway test-giveaway-1')
      );
    });

    it('should handle message edit failures', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Test Prize',
        description: 'Test Description',
        endTime: pastDate,
        winnersCount: 1,
        participants: [],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([]);
      mockMessage.edit.mockRejectedValueOnce(new Error('Missing permissions'));

      await schedulerFunction();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas edycji wiadomości giveaway test-giveaway-1')
      );
    });
  });

  describe('Database Integration', () => {
    it('should work with concurrent scheduler executions', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await GiveawayModel.create([
        {
          giveawayId: 'giveaway-1',
          guildId: 'test-guild-123',
          channelId: 'test-channel-123',
          messageId: 'message-1',
          hostId: 'test-host-123',
          prize: 'Prize 1',
          description: 'Description 1',
          endTime: pastDate,
          winnersCount: 1,
          participants: [],
          active: true,
          finalized: false,
        },
        {
          giveawayId: 'giveaway-2',
          guildId: 'test-guild-123',
          channelId: 'test-channel-123',
          messageId: 'message-2',
          hostId: 'test-host-123',
          prize: 'Prize 2',
          description: 'Description 2',
          endTime: pastDate,
          winnersCount: 1,
          participants: [],
          active: true,
          finalized: false,
        },
      ]);

      mockPickWinners.mockResolvedValue([]);
      mockChannel.messages.fetch.mockResolvedValue(mockMessage);
      await Promise.all([
        schedulerFunction(),
        schedulerFunction(),
      ]);

      const finalizedCount = await GiveawayModel.countDocuments({ finalized: true });
      expect(finalizedCount).toBe(2);
    });

    it('should preserve giveaway data integrity', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      const originalGiveaway = await GiveawayModel.create({
        giveawayId: 'test-giveaway-1',
        guildId: 'test-guild-123',
        channelId: 'test-channel-123',
        messageId: 'test-message-123',
        hostId: 'test-host-123',
        prize: 'Original Prize',
        description: 'Original Description',
        endTime: pastDate,
        winnersCount: 2,
        participants: ['user1', 'user2', 'user3'],
        active: true,
        finalized: false,
      });

      mockPickWinners.mockResolvedValue([{ id: 'user1' }]);

      await schedulerFunction();

      const updatedGiveaway = await GiveawayModel.findById(originalGiveaway._id);
      expect(updatedGiveaway?.giveawayId).toBe('test-giveaway-1');
      expect(updatedGiveaway?.prize).toBe('Original Prize');
      expect(updatedGiveaway?.participants).toEqual(['user1', 'user2', 'user3']);
      expect(updatedGiveaway?.winnersCount).toBe(2);
      expect(updatedGiveaway?.active).toBe(false);
      expect(updatedGiveaway?.finalized).toBe(true);
    });
  });
});