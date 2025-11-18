import { EventHarness, createEventHarness, resetEventHarness } from './eventHarness';
import { dbManager } from '../setup/db';
import { Client, GuildMember, VoiceState, Message, User, Guild } from 'discord.js';

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

function createMockVoiceState(data: { channelId: string | null; member: GuildMember }): VoiceState {
  return {
    channelId: data.channelId,
    channel: data.channelId ? { id: data.channelId, name: 'Test Voice Channel' } : null,
    member: data.member,
    guild: data.member.guild,
    setChannel: jest.fn().mockResolvedValue(undefined)
  } as any;
}

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
  }, 15000);

  afterAll(async () => {
    await dbManager.stopDb();
  }, 15000);

  beforeEach(async () => {
    await dbManager.clearCollections();
    resetEventHarness();
    harness = createEventHarness();
    
    client = new Client({ intents: [] });
    
    harness.setClient(client);
  });

  afterEach(() => {
    if (harness) {
      harness.reset();
    }
  });

  describe('Basic Event Emission', () => {
    it('should emit and track ready event', async () => {
      let readyEmitted = false;
      client.on('clientReady', () => {
        readyEmitted = true;
      });

      await harness.emitReady(client);

      expect(readyEmitted).toBe(true);
      expect(harness.getEventCount('clientReady')).toBe(1);
    });

    it('should track multiple events', async () => {
      const member = createMockGuildMember({
        id: '123456789',
        username: 'TestUser'
      });

      await harness.emitGuildMemberAdd(member);
      await harness.emitGuildMemberAdd(member);
      await harness.emitGuildMemberRemove(member);

      expect(harness.getEventCount('guildMemberAdd')).toBe(2);
      expect(harness.getEventCount('guildMemberRemove')).toBe(1);
      
      const stats = harness.getEventStats();
      expect(stats.guildMemberAdd).toBe(2);
      expect(stats.guildMemberRemove).toBe(1);
    });
  });

  describe('Event Waiting', () => {
    it('should wait for specific event with timeout', async () => {
      const member = createMockGuildMember({
        id: '123456789',
        username: 'TestUser'
      });

      setTimeout(async () => {
        await harness.emitGuildMemberAdd(member);
      }, 100);

      const [receivedMember] = await harness.waitFor('guildMemberAdd', undefined, 1000);
      expect(receivedMember.user.id).toBe('123456789');
    });

    it('should timeout when event is not emitted', async () => {
      await expect(
        harness.waitFor('nonExistentEvent', undefined, 100)
      ).rejects.toThrow('Timeout oczekiwania na zdarzenie');
    });

    it('should wait with predicate filter', async () => {
      const member1 = createMockGuildMember({
        id: '111111111',
        username: 'User1'
      });
      const member2 = createMockGuildMember({
        id: '222222222',
        username: 'User2'
      });
      const waitPromise = harness.waitFor(
        'guildMemberAdd',
        (member: GuildMember) => member.user.id === '222222222',
        5000
      );

      setTimeout(async () => {
        await harness.emitGuildMemberAdd(member1);
        await harness.emitGuildMemberAdd(member2);
      }, 100);
      const [receivedMember] = await waitPromise;
      expect(receivedMember.user.id).toBe('222222222');
    }, 15000);
  });

  describe('Voice State Events', () => {
    it('should simulate user joining voice channel', async () => {
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

      let voiceEventReceived = false;
      client.on('voiceStateUpdate', (old, updated) => {
        voiceEventReceived = true;
        expect(old.channelId).toBeNull();
        expect(updated.channelId).toBe('999888777');
      });

      await harness.emitVoiceStateUpdate(oldState, newState);
      expect(voiceEventReceived).toBe(true);
      expect(harness.getEventCount('voiceStateUpdate')).toBe(1);
    });

    it('should simulate voice channel flow with helper method', async () => {
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

      await harness.simulateUserJoiningVoice(member, oldState, newState);
      expect(harness.getEventCount('voiceStateUpdate')).toBe(1);
    });
  });

  describe('Member Events', () => {
    it('should simulate complete new user flow', async () => {
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

      await harness.simulateNewUserFlow(member);
      await harness.waitForProcessing();
      expect(addEventReceived).toBe(true);
      expect(updateEventReceived).toBe(true);
      expect(harness.getEventCount('guildMemberAdd')).toBe(1);
      expect(harness.getEventCount('guildMemberUpdate')).toBe(1);
    }, 15000);

    it('should simulate server boost event', async () => {
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

      await harness.simulateServerBoost(oldMember, newMember);
      expect(boostEventReceived).toBe(true);
      expect(harness.getEventCount('guildMemberUpdate')).toBe(1);
    });
  });

  describe('Message Events', () => {
    it('should simulate message creation', async () => {
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

      await harness.emitMessageCreate(message);
      expect(messageReceived).toBe(true);
      expect(harness.getEventCount('messageCreate')).toBe(1);
    });

    it('should simulate message update', async () => {
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

      await harness.emitMessageUpdate(oldMessage, newMessage);
      expect(updateReceived).toBe(true);
      expect(harness.getEventCount('messageUpdate')).toBe(1);
    });
  });

  describe('Batch Events', () => {
    it('should process batch events with delays', async () => {
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

      const startTime = Date.now();
      await harness.emitBatch(events);
      const endTime = Date.now();
      expect(addReceived).toBe(true);
      expect(updateReceived).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
      expect(harness.getEventCount('guildMemberAdd')).toBe(1);
      expect(harness.getEventCount('guildMemberUpdate')).toBe(1);
    });
  });

  describe('Event Queue and Processing', () => {
    it('should track event queue', async () => {
      const member = createMockGuildMember({
        id: '123456789',
        username: 'QueueUser'
      });

      await harness.emitGuildMemberAdd(member);
      const queue = harness.getEventQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].event).toBe('guildMemberAdd');
      expect(queue[0].data[0]).toBe(member);
      expect(queue[0].timestamp).toBeGreaterThan(0);
    });

    it('should wait for processing completion', async () => {
      const processingPromise = harness.waitForProcessing();
      
      setTimeout(() => {
        harness.clearEventQueue();
      }, 100);
      await expect(processingPromise).resolves.toBeUndefined();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should throw error when client not set', async () => {
      const newHarness = createEventHarness();
      newHarness.setClient(null as any);

      await expect(
        newHarness.emitEvent('clientReady')
      ).rejects.toThrow('Client nie został ustawiony');
    });

    it('should handle cleanup properly', () => {
      harness.on('testEvent', () => {});
      harness.on('anotherEvent', () => {});
      
      expect(Object.keys(harness.getActiveListeners())).toHaveLength(2);

      harness.clearEventListeners('testEvent');
      const listeners = harness.getActiveListeners();
      expect(listeners.testEvent).toBeUndefined();
      expect(listeners.anotherEvent).toBe(1);
    });
  });
});