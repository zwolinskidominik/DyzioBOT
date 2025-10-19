import { Client, ChannelType } from 'discord.js';
import { createEventHarness, resetEventHarness, EventHarness } from '../../discord/eventHarness';
import { setupDatabase, cleanDatabase, teardownDatabase } from '../../setup/db';
import logger from '../../../../src/utils/logger';
import tempChannelHandler from '../../../../src/events/voiceStateUpdate/tempChannel';
import { TempChannelConfigurationModel } from '../../../../src/models/TempChannelConfiguration';
import { TempChannelModel } from '../../../../src/models/TempChannel';

// Small async helpers
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(predicate: () => boolean, { timeoutMs = 5000, intervalMs = 25 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }
  throw new Error('waitFor: condition not met in time');
}

// Minimal voice/guild/channel mocks
function createMockGuild() {
  const created: any[] = [];
  const guild: any = {
    id: 'guild-1',
    channels: {
      create: jest.fn(async (opts: any) => {
        const ch: any = {
          id: `vc-${Math.random().toString(36).slice(2)}`,
          type: ChannelType.GuildVoice,
          name: opts.name || 'temp',
          members: new Map(),
          delete: jest.fn(async () => ch),
          parent: opts.parent,
          userLimit: opts.userLimit,
          permissionOverwrites: { cache: [] },
        };
        created.push(ch);
        return ch;
      }),
    },
  };
  return { guild, created } as const;
}

function createMockVoiceState(opts: {
  guild: any;
  channelId: string | null;
  channel?: any;
  memberId?: string;
  setChannelBehavior?: (newCh: any) => Promise<void>;
}) {
  const state: any = {
    guild: opts.guild,
    channelId: opts.channelId,
    channel: opts.channel ?? (opts.channelId ? { id: opts.channelId, type: ChannelType.GuildVoice, members: new Map(), delete: jest.fn(async () => ({})) } : null),
    member: opts.memberId ? { id: opts.memberId } : { id: 'user-1' },
    setChannel: jest.fn(async (newCh: any) => {
      if (opts.setChannelBehavior) return opts.setChannelBehavior(newCh);
      // default OK
      state.channelId = newCh?.id ?? null;
      state.channel = newCh ?? null;
    }),
  };
  return state;
}

describe('voiceStateUpdate: tempChannel (E2E)', () => {
  let harness: EventHarness;
  let client: Client;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;

  beforeAll(async () => {
    await setupDatabase();
  }, 30000);

  afterAll(async () => {
    await teardownDatabase();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase();
    resetEventHarness();
    harness = createEventHarness();
    client = new Client({ intents: [] });
    harness.setClient(client);

    // Wire handler
    client.on('voiceStateUpdate', async (oldS, newS) => {
      await tempChannelHandler(oldS as any, newS as any);
    });

    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(((..._args: unknown[]) => logger) as any);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(((..._args: unknown[]) => logger) as any);
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(((..._args: unknown[]) => logger) as any);
  });

  afterEach(async () => {
    client.removeAllListeners();
    jest.restoreAllMocks();
  });

  it('join on monitored channel → creates temp channel and moves user', async () => {
    const { guild, created } = createMockGuild();
    await TempChannelConfigurationModel.create({ guildId: 'guild-1', channelId: 'monitored' });

    const oldState = createMockVoiceState({ guild, channelId: null, memberId: 'user-1' });
  const monitoredChannel = { id: 'monitored', type: ChannelType.GuildVoice, name: 'Monitored', members: new Map(), permissionOverwrites: { cache: [] }, parent: { id: 'parent-1' } };
    const newState = createMockVoiceState({ guild, channelId: 'monitored', channel: monitoredChannel, memberId: 'user-1' });

  await harness.emitVoiceStateUpdate(oldState as any, newState as any);
  await sleep(50);

    // Wait until the temp channel doc is persisted (handler saves before move)
    let tempDoc = await TempChannelModel.findOne();
    for (let i = 0; i < 50 && !tempDoc; i++) {
      await sleep(20);
      tempDoc = await TempChannelModel.findOne();
    }
    expect(tempDoc).not.toBeNull();

    // A new channel should be created
    expect(guild.channels.create).toHaveBeenCalled();
    expect(created.length).toBe(1);

    // User moved to the new channel (assert by id to avoid object identity flakiness)
    expect(newState.setChannel).toHaveBeenCalled();
    expect(newState.setChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: tempDoc!.channelId })
    );

    // DB saved
    const tempDocs = await TempChannelModel.find();
    expect(tempDocs).toHaveLength(1);
    expect(tempDocs[0].channelId).toBe(tempDoc!.channelId);
    // Also verify we created a channel with the persisted id
    expect(created.some((c) => c.id === tempDoc!.channelId)).toBe(true);
  }, 20000);

  it('leave → cleans up empty temp channel', async () => {
    const { guild } = createMockGuild();
    await TempChannelConfigurationModel.create({ guildId: 'guild-1', channelId: 'monitored' });

    // First join to create temp channel
    const oldState = createMockVoiceState({ guild, channelId: null, memberId: 'user-1' });
  const monitoredChannel = { id: 'monitored', type: ChannelType.GuildVoice, name: 'Monitored', members: new Map(), permissionOverwrites: { cache: [] }, parent: { id: 'parent-1' } };
    const newState = createMockVoiceState({ guild, channelId: 'monitored', channel: monitoredChannel, memberId: 'user-1' });
  await harness.emitVoiceStateUpdate(oldState as any, newState as any);
  // Wait for the temp channel to be persisted
  await waitFor(() => true, { timeoutMs: 1, intervalMs: 1 });
  await sleep(40);

    const tempDoc = await TempChannelModel.findOne({ guildId: 'guild-1' });
    expect(tempDoc).not.toBeNull();
    const tempChannel = { id: tempDoc!.channelId, type: ChannelType.GuildVoice, members: new Map(), delete: jest.fn(async () => ({})) };

    // Now simulate leaving the temp channel → oldState has the temp channel with 0 members
    const oldWithTemp = createMockVoiceState({ guild, channelId: tempChannel.id, channel: tempChannel });
    const newAway = createMockVoiceState({ guild, channelId: null });

  await harness.emitVoiceStateUpdate(oldWithTemp as any, newAway as any);
  await sleep(40);

    // Channel delete invoked
    expect(tempChannel.delete).toHaveBeenCalled();

    // DB cleanup
    const tempDocs = await TempChannelModel.find();
    expect(tempDocs).toHaveLength(0);
  }, 20000);

  it('no permissions (50013) during move → logs error, no crash', async () => {
    const { guild, created } = createMockGuild();
    await TempChannelConfigurationModel.create({ guildId: 'guild-1', channelId: 'monitored' });

    const oldState = createMockVoiceState({ guild, channelId: null, memberId: 'user-1' });
  const monitoredChannel = { id: 'monitored', type: ChannelType.GuildVoice, name: 'Monitored', members: new Map(), permissionOverwrites: { cache: [] }, parent: { id: 'parent-1' } };
    const newState = createMockVoiceState({
      guild,
      channelId: 'monitored',
      channel: monitoredChannel,
      memberId: 'user-1',
      setChannelBehavior: async () => {
        const err: any = new Error('Missing Permissions');
        err.code = 50013;
        throw err;
      },
    });

  await harness.emitVoiceStateUpdate(oldState as any, newState as any);
  // Wait for error path after retries
  await waitFor(() => (errorSpy as any).mock?.calls?.some?.((args: any[]) => String(args?.[0] ?? '').includes('Błąd podczas obsługi voiceStateUpdate')) ?? false, { timeoutMs: 5000, intervalMs: 30 });

    // Should attempt to create channel
    expect(guild.channels.create).toHaveBeenCalled();
    // Error path must be logged and not crash the test
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas obsługi voiceStateUpdate'));
  }, 20000);

  it('brak konfiguracji → no-op (silent)', async () => {
    const { guild } = createMockGuild();
    const oldState = createMockVoiceState({ guild, channelId: null });
  const newState = createMockVoiceState({ guild, channelId: 'monitored', channel: { id: 'monitored', type: ChannelType.GuildVoice, members: new Map(), permissionOverwrites: { cache: [] }, parent: { id: 'parent-1' } } });

  await harness.emitVoiceStateUpdate(oldState as any, newState as any);
  await sleep(30);

    // No DB records
    expect(await TempChannelModel.countDocuments()).toBe(0);
    // Silent when no configuration exists
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  }, 20000);
});
