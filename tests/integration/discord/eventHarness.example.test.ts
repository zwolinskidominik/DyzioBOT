import { EventHarness, createEventHarness, resetEventHarness } from './eventHarness';
import { dbManager } from '../setup/db';
import { Client, GuildMember, VoiceState, Message, User, Guild } from 'discord.js';

// Helper function to create mock GuildMember
function createMockGuildMember(data: { id: string; username: string; premiumSince?: Date | null }): GuildMember {
  return {
    user: {
      id: data.id,
      username: data.username,
      tag: `${data.username}#0001`,
      bot: false
    },
    guild: {
      id: '1264582308003053570',
      name: 'Test Server'
    },
    premiumSince: data.premiumSince ?? null,
    roles: {
      add: jest.fn().mockResolvedValue(undefined),
      cache: new Map()
    }
  } as any;
}

// Helper function to create mock VoiceState
function createMockVoiceState(data: { channelId: string | null; member: GuildMember }): VoiceState {
  return {
    channelId: data.channelId,
    channel: data.channelId ? { id: data.channelId, name: 'Test Voice Channel' } : null,
    member: data.member,
    guild: data.member.guild,
    setChannel: jest.fn().mockResolvedValue(undefined)
  } as any;
}

// Helper function to create mock Message
function createMockMessage(data: { id: string; content: string; author?: any }): Message {
  return {
    id: data.id,
    content: data.content,
    author: data.author || {
      id: '987654321',
      username: 'TestUser',
      discriminator: '0001',
      bot: false
    },
    guild: {
      id: '1264582308003053570',
      name: 'Test Server'
    }
  } as any;
}

describe('EventHarness Integration Tests', () => {
  let harness: EventHarness;
  let client: Client;

  beforeAll(async () => {
    await dbManager.startDb();
  }, 15000); // Increase timeout to 15 seconds

  afterAll(async () => {
    await dbManager.stopDb();
  }, 15000); // Increase timeout to 15 seconds

  beforeEach(async () => {
    await dbManager.clearCollections();
    
    // Reset harness między testami
    resetEventHarness();
    harness = createEventHarness();
    
    // Stwórz mocka klienta
    client = new Client({ intents: [] });
    
    // Ustaw klienta w harness
    harness.setClient(client);
  });

  afterEach(() => {
    if (harness) {
      harness.reset();
    }
  });

  describe('Basic Event Emission', () => {
    it('should emit and track ready event', async () => {
      // Arrange
      let readyEmitted = false;
      client.on('ready', () => {
        readyEmitted = true;
      });

      // Act
      await harness.emitReady(client);

      // Assert
      expect(readyEmitted).toBe(true);
      expect(harness.getEventCount('ready')).toBe(1);
    });

    it('should track multiple events', async () => {
      // Arrange
      const member = createMockGuildMember({
        id: '123456789',
        username: 'TestUser'
      });

      // Act
      await harness.emitGuildMemberAdd(member);
      await harness.emitGuildMemberAdd(member);
      await harness.emitGuildMemberRemove(member);

      // Assert
      expect(harness.getEventCount('guildMemberAdd')).toBe(2);
      expect(harness.getEventCount('guildMemberRemove')).toBe(1);
      
      const stats = harness.getEventStats();
      expect(stats.guildMemberAdd).toBe(2);
      expect(stats.guildMemberRemove).toBe(1);
    });
  });

  describe('Event Waiting', () => {
    it('should wait for specific event with timeout', async () => {
      // Arrange
      const member = createMockGuildMember({
        id: '123456789',
        username: 'TestUser'
      });

      // Act - emit event after delay
      setTimeout(async () => {
        await harness.emitGuildMemberAdd(member);
      }, 100);

      // Assert - wait for event
      const [receivedMember] = await harness.waitFor('guildMemberAdd', undefined, 1000);
      expect(receivedMember.user.id).toBe('123456789');
    });

    it('should timeout when event is not emitted', async () => {
      // Act & Assert
      await expect(
        harness.waitFor('nonExistentEvent', undefined, 100)
      ).rejects.toThrow('Timeout oczekiwania na zdarzenie');
    });

    it('should wait with predicate filter', async () => {
      // Arrange
      const member1 = createMockGuildMember({
        id: '111111111',
        username: 'User1'
      });
      const member2 = createMockGuildMember({
        id: '222222222',
        username: 'User2'
      });

      // Setup waitFor first, then emit events
      const waitPromise = harness.waitFor(
        'guildMemberAdd',
        (member: GuildMember) => member.user.id === '222222222',
        5000
      );

      // Act - emit wrong member first, then correct one after a small delay
      setTimeout(async () => {
        await harness.emitGuildMemberAdd(member1);
        await harness.emitGuildMemberAdd(member2);
      }, 100);

      // Assert - wait for specific member
      const [receivedMember] = await waitPromise;
      expect(receivedMember.user.id).toBe('222222222');
    }, 15000); // Increase Jest test timeout to 15 seconds
  });

  describe('Voice State Events', () => {
    it('should simulate user joining voice channel', async () => {
      // Arrange
      const member = createMockGuildMember({
        id: '123456789',
        username: 'VoiceUser'
      });
      
      const oldState = createMockVoiceState({
        channelId: null, // Nie był w kanale
        member
      });
      
      const newState = createMockVoiceState({
        channelId: '999888777',
        member
      });

      let voiceEventReceived = false;
      client.on('voiceStateUpdate', (old, updated) => {
        voiceEventReceived = true;
        expect(old.channelId).toBeNull();
        expect(updated.channelId).toBe('999888777');
      });

      // Act
      await harness.emitVoiceStateUpdate(oldState, newState);

      // Assert
      expect(voiceEventReceived).toBe(true);
      expect(harness.getEventCount('voiceStateUpdate')).toBe(1);
    });

    it('should simulate voice channel flow with helper method', async () => {
      // Arrange
      const member = createMockGuildMember({
        id: '123456789',
        username: 'VoiceUser'
      });
      
      const oldState = createMockVoiceState({
        channelId: null,
        member
      });
      
      const newState = createMockVoiceState({
        channelId: '999888777',
        member
      });

      // Act
      await harness.simulateUserJoiningVoice(member, oldState, newState);

      // Assert
      expect(harness.getEventCount('voiceStateUpdate')).toBe(1);
    });
  });

  describe('Member Events', () => {
    it('should simulate complete new user flow', async () => {
      // Arrange
      const member = createMockGuildMember({
        id: '123456789',
        username: 'NewUser'
      });

      let addEventReceived = false;
      let updateEventReceived = false;

      client.on('guildMemberAdd', () => {
        addEventReceived = true;
      });

      client.on('guildMemberUpdate', () => {
        updateEventReceived = true;
      });

      // Act
      await harness.simulateNewUserFlow(member);
      await harness.waitForProcessing();

      // Assert
      expect(addEventReceived).toBe(true);
      expect(updateEventReceived).toBe(true);
      expect(harness.getEventCount('guildMemberAdd')).toBe(1);
      expect(harness.getEventCount('guildMemberUpdate')).toBe(1);
    }, 15000); // Increase Jest test timeout to 15 seconds

    it('should simulate server boost event', async () => {
      // Arrange
      const oldMember = createMockGuildMember({
        id: '123456789',
        username: 'Booster',
        premiumSince: null
      });

      const newMember = createMockGuildMember({
        id: '123456789',
        username: 'Booster',
        premiumSince: new Date()
      });

      let boostEventReceived = false;
      client.on('guildMemberUpdate', (old, updated) => {
        boostEventReceived = true;
        expect(old.premiumSince).toBeNull();
        expect(updated.premiumSince).toBeInstanceOf(Date);
      });

      // Act
      await harness.simulateServerBoost(oldMember, newMember);

      // Assert
      expect(boostEventReceived).toBe(true);
      expect(harness.getEventCount('guildMemberUpdate')).toBe(1);
    });
  });

  describe('Message Events', () => {
    it('should simulate message creation', async () => {
      // Arrange
      const message = createMockMessage({
        id: '123456789',
        content: 'Test message',
        author: {
          id: '987654321',
          username: 'TestUser',
          discriminator: '0001',
          bot: false
        }
      });

      let messageReceived = false;
      client.on('messageCreate', (msg) => {
        messageReceived = true;
        expect(msg.content).toBe('Test message');
      });

      // Act
      await harness.emitMessageCreate(message);

      // Assert
      expect(messageReceived).toBe(true);
      expect(harness.getEventCount('messageCreate')).toBe(1);
    });

    it('should simulate message update', async () => {
      // Arrange
      const oldMessage = createMockMessage({
        id: '123456789',
        content: 'Original content'
      });

      const newMessage = createMockMessage({
        id: '123456789',
        content: 'Updated content'
      });

      let updateReceived = false;
      client.on('messageUpdate', (old, updated) => {
        updateReceived = true;
        expect(old?.content).toBe('Original content');
        expect(updated.content).toBe('Updated content');
      });

      // Act
      await harness.emitMessageUpdate(oldMessage, newMessage);

      // Assert
      expect(updateReceived).toBe(true);
      expect(harness.getEventCount('messageUpdate')).toBe(1);
    });
  });

  describe('Batch Events', () => {
    it('should process batch events with delays', async () => {
      // Arrange
      const member = createMockGuildMember({
        id: '123456789',
        username: 'BatchUser'
      });

      const events = [
        {
          type: 'guildMemberAdd',
          args: [member],
          delay: 0
        },
        {
          type: 'guildMemberUpdate',
          args: [member, member],
          delay: 50
        }
      ];

      let addReceived = false;
      let updateReceived = false;

      client.on('guildMemberAdd', () => {
        addReceived = true;
      });

      client.on('guildMemberUpdate', () => {
        updateReceived = true;
      });

      // Act
      const startTime = Date.now();
      await harness.emitBatch(events);
      const endTime = Date.now();

      // Assert
      expect(addReceived).toBe(true);
      expect(updateReceived).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50); // Sprawdza delay
      expect(harness.getEventCount('guildMemberAdd')).toBe(1);
      expect(harness.getEventCount('guildMemberUpdate')).toBe(1);
    });
  });

  describe('Event Queue and Processing', () => {
    it('should track event queue', async () => {
      // Arrange
      const member = createMockGuildMember({
        id: '123456789',
        username: 'QueueUser'
      });

      // Act
      await harness.emitGuildMemberAdd(member);
      const queue = harness.getEventQueue();

      // Assert
      expect(queue).toHaveLength(1);
      expect(queue[0].event).toBe('guildMemberAdd');
      expect(queue[0].data[0]).toBe(member);
      expect(queue[0].timestamp).toBeGreaterThan(0);
    });

    it('should wait for processing completion', async () => {
      // Act
      const processingPromise = harness.waitForProcessing();
      
      // Symuluj opróżnienie kolejki
      setTimeout(() => {
        harness.clearEventQueue();
      }, 100);

      // Assert
      await expect(processingPromise).resolves.toBeUndefined();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should throw error when client not set', async () => {
      // Arrange
      const newHarness = createEventHarness();
      newHarness.setClient(null as any);

      // Act & Assert
      await expect(
        newHarness.emitEvent('ready')
      ).rejects.toThrow('Client nie został ustawiony');
    });

    it('should handle cleanup properly', () => {
      // Arrange
      harness.on('testEvent', () => {});
      harness.on('anotherEvent', () => {});
      
      expect(Object.keys(harness.getActiveListeners())).toHaveLength(2);

      // Act
      harness.clearEventListeners('testEvent');

      // Assert
      const listeners = harness.getActiveListeners();
      expect(listeners.testEvent).toBeUndefined();
      expect(listeners.anotherEvent).toBe(1);
    });
  });
});