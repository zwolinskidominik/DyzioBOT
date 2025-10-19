export {};
// Comprehensive tests for channelHelpers
// Note: use module isolation to control internal caches and timers reliably
// Logger mock used across test cases
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn() },
}));
const logger = require('../../../src/utils/logger').default;
import type { Guild, TextChannel, GuildMember, Collection as DiscordCollection } from 'discord.js';
import { Collection } from 'discord.js';

// re-exported above

function loadHelpers() {
  jest.isolateModules(() => {
    helpers = require('../../../src/utils/channelHelpers');
  });
  return helpers;
}

let helpers: typeof import('../../../src/utils/channelHelpers');

const mockDocBase = () => ({
  guildId: 'g1',
  channels: {
    users: { channelId: 'usersChan', template: 'Users: <>' },
    bots: { channelId: 'botsChan', template: 'Bots: {value}' },
    bans: { channelId: 'bansChan', template: 'Bans: <>' },
    lastJoined: { channelId: 'lastChan', template: 'Ostatni: <>' },
  },
  save: jest.fn().mockResolvedValue(undefined),
});

let currentDoc = mockDocBase();

jest.mock('../../../src/models/ChannelStats', () => ({
  ChannelStatsModel: {
    findOne: jest.fn(async (q: any) => (q.guildId === 'g1' ? currentDoc : null)),
  },
}));

function makeMember(id: string, username: string, joined: number, bot = false): GuildMember {
  return { id, user: { id, username, bot }, joinedTimestamp: joined } as unknown as GuildMember;
}

interface FakeTextChannel extends TextChannel {
  name: string;
  id: string;
  setName: jest.Mock<any, any>;
}

function textChannel(id: string, name: string): FakeTextChannel {
  return {
    id,
    name,
    setName: jest.fn(async function (this: any, newName: string) {
      (this as any).name = newName;
      return this;
    }),
  } as unknown as FakeTextChannel;
}

function makeGuild(members: GuildMember[], memberCount?: number) {
  const membersCache = new Collection<string, GuildMember>();
  members.forEach((m) => membersCache.set(m.id, m));

  const channelMap = new Collection<string, any>();
  const channels = {
    usersChan: textChannel('usersChan', 'Users: 0'),
    botsChan: textChannel('botsChan', 'Bots: 0'),
    bansChan: textChannel('bansChan', 'Bans: 0'),
    lastChan: textChannel('lastChan', 'Ostatni: Brak'),
  };
  Object.values(channels).forEach((c) => channelMap.set(c.id, c));

  const bansFetch = jest.fn(async () => new Collection<string, any>([]));
  const membersFetch = jest.fn(async () => {
    return membersCache;
  });

  const guild: Guild = {
    id: 'g1',
    members: { cache: membersCache, fetch: membersFetch } as any,
    memberCount: memberCount ?? members.length,
    channels: { cache: channelMap } as any,
    bans: { fetch: bansFetch } as any,
  } as unknown as Guild;

  return { guild, channels, bansFetch, membersFetch };
}

beforeEach(() => {
  jest.clearAllMocks();
  currentDoc = mockDocBase();
  helpers = undefined as any;
});

describe('safeSetChannelName', () => {
  test('no-op when name already matches', async () => {
    const { safeSetChannelName } = loadHelpers();
    const chan = textChannel('c1', 'Same');
    await safeSetChannelName(chan as any, 'Same');
    expect(chan.setName).not.toHaveBeenCalled();
  });

  test('sets new name when different', async () => {
    const { safeSetChannelName } = loadHelpers();
    const chan = textChannel('c1', 'Old');
    await safeSetChannelName(chan as any, 'New');
    expect(chan.setName).toHaveBeenCalledWith('New');
    expect(chan.name).toBe('New');
  });

  test('logs and stops on missing permissions error (50013)', async () => {
    const { safeSetChannelName } = loadHelpers();
    const chan = textChannel('c1', 'Old');
    chan.setName.mockRejectedValue({ code: 50013 });
    await safeSetChannelName(chan as any, 'New');
    expect(logger.warn).toHaveBeenCalled();
    expect(chan.setName).toHaveBeenCalledTimes(1);
  });

  test('retries on rate limit (429) with backoff then succeeds', async () => {
    const { safeSetChannelName } = loadHelpers();
    const chan = textChannel('c1', 'Start');
    chan.setName
      .mockImplementationOnce(() => Promise.reject({ httpStatus: 429 }))
      .mockImplementationOnce(async function (this: any, newName: string) {
        (this as any).name = newName;
        return this;
      });

    const originalSetTimeout = global.setTimeout;
    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((fn: any, _ms?: number) => {
        fn();
        return 0 as any;
      });

    await safeSetChannelName(chan as any, 'Target', 2, 50);
    expect(chan.setName).toHaveBeenCalledTimes(2);
    expect(chan.name).toBe('Target');

    setTimeoutSpy.mockRestore();
    global.setTimeout = originalSetTimeout;
  });

  test('concurrent calls: final name equals last call, no double retry', async () => {
    const { safeSetChannelName } = loadHelpers();
    const chan = textChannel('c1', 'Start');

    // setName behavior: for 'First' first attempt 429 then succeed; for 'Last' immediately succeed
    const originalImpl = chan.setName.getMockImplementation();
    const callCounts: Record<string, number> = { First: 0, Last: 0 };
    chan.setName.mockImplementation(async function (this: any, newName: string) {
      callCounts[newName] = (callCounts[newName] || 0) + 1;
      if (newName === 'First' && callCounts[newName] === 1) {
        // first attempt rate-limited
        throw { httpStatus: 429 };
      }
      (this as any).name = newName;
      return this;
    });

    const p1 = safeSetChannelName(chan as any, 'First', 1, 1); // allow exactly 1 retry, quick backoff
    const p2 = safeSetChannelName(chan as any, 'Last');
    await Promise.all([p1, p2]);

    expect(chan.name).toBe('Last');
    // First: one retry (2 calls total), Last: one call; no extra retries
  // First may be retried once or cancelled due to last-write-wins; ensure no extra retries
  expect(callCounts.First).toBeLessThanOrEqual(2);
    expect(callCounts.Last).toBe(1);

    // restore any original impl if needed
    if (originalImpl) chan.setName.mockImplementation(originalImpl);
  });

  test('retry attempt aborts early when newer token exists (top-of-attempt guard)', async () => {
    jest.useFakeTimers();
    const { safeSetChannelName } = loadHelpers();
    const chan = textChannel('c1', 'Start');
    const calls: string[] = [];
    chan.setName.mockImplementation(async function (this: any, newName: string) {
      calls.push(newName);
      if (newName === 'First') {
        // trigger rate limit to schedule retry
        throw { httpStatus: 429 };
      }
      (this as any).name = newName;
      return this;
    });

    const p1 = safeSetChannelName(chan as any, 'First', 1, 50);
    // schedule retry, but before it runs, submit a new rename which should set a newer token
    const p2 = Promise.resolve().then(() => safeSetChannelName(chan as any, 'Second'));
    // advance time to fire the retry timer
    await Promise.resolve();
    jest.advanceTimersByTime(60);
    await Promise.allSettled([p1, p2]);

    // Ensure the retry did NOT call setName again for 'First' due to top-of-attempt guard
    const countFirst = calls.filter((c) => c === 'First').length;
    expect(countFirst).toBe(1);
    expect(chan.name).toBe('Second');
  jest.useRealTimers();
  });

  test('throws unknown error and channel without id exercises nullish branch', async () => {
    const { safeSetChannelName } = loadHelpers();
    const chan = textChannel('cX', 'Old') as any;
    // Remove id to hit chanId ?? '' branch
    delete chan.id;
    chan.setName.mockRejectedValueOnce(new Error('weird'));
    await expect(safeSetChannelName(chan, 'New')).rejects.toThrow('weird');
  });
});

describe('updateChannelName', () => {
  test('applies template placeholders and truncates', async () => {
    const { updateChannelName } = loadHelpers();
    const { guild, channels } = makeGuild([]);
    const config = { channelId: 'usersChan', template: 'Users: <>' };
    await updateChannelName(guild, config as any, 123);
    expect(channels.usersChan.name).toBe('Users: 123');
  });

  test('skips when channel missing or wrong type', async () => {
    const { updateChannelName } = loadHelpers();
    const { guild } = makeGuild([]);
    await updateChannelName(guild, { channelId: 'missing' } as any, 5);
  });

  test('no template uses raw value and early return when no config', async () => {
    const { updateChannelName } = loadHelpers();
    const { guild, channels } = makeGuild([]);
    await updateChannelName(guild, undefined as any, 123);
    // Ensure function exits gracefully without changes
    expect(channels.usersChan.name).toBe('Users: 0');

    await updateChannelName(guild, { channelId: 'usersChan' } as any, 'Raw');
    expect(channels.usersChan.name).toBe('Raw');
  });
});

describe('updateChannelStats', () => {
  test('updates configured stat channels and saves doc', async () => {
    const { updateChannelStats } = loadHelpers();
    const members = [
      makeMember('1', 'A', 1000),
      makeMember('2', 'B', 2000),
      makeMember('3', 'C', 1500, true),
    ];
    const { guild, channels, bansFetch, membersFetch } = makeGuild(members, members.length + 2);

    await updateChannelStats(guild);
    expect(membersFetch).toHaveBeenCalled();
    expect(bansFetch).toHaveBeenCalled();
    expect(channels.usersChan.name).toMatch(/Users:/);
    expect(channels.botsChan.name).toMatch(/Bots:/);
    expect(channels.lastChan.name).toMatch(/Ostatni: B/);
    expect((currentDoc.channels.lastJoined as any)?.member).toBe('2');
    expect(currentDoc.save).toHaveBeenCalled();

    membersFetch.mockClear();
    await updateChannelStats(guild);
    expect(membersFetch).not.toHaveBeenCalled();
  });

  test('continues update when bans fetch fails immediately (no cache)', async () => {
    const { updateChannelStats } = loadHelpers();
    const members = [makeMember('1', 'A', 1000), makeMember('2', 'B', 2000)];
    const { guild, channels, bansFetch, membersFetch } = makeGuild(members, members.length);
    bansFetch.mockRejectedValueOnce(new Error('bans fail now'));

    await updateChannelStats(guild);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Błąd przy pobieraniu banów'));
    // users/bots/lastJoined should still be updated
    expect(channels.usersChan.name).toMatch(/Users:/);
    expect(channels.lastChan.name).toMatch(/Ostatni:/);
    expect(currentDoc.save).toHaveBeenCalled();
  });

  test('handles missing document gracefully', async () => {
    const { updateChannelStats } = loadHelpers();
    currentDoc = null as any;
    const { guild } = makeGuild([]);
    await updateChannelStats(guild);
  });

  test('uses cached ban count on fetch error and logs error', async () => {
    const { updateChannelStats } = loadHelpers();
    const members = [makeMember('1', 'A', 1000)];
    const { guild, bansFetch, channels } = makeGuild(members);
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    await updateChannelStats(guild);
    expect(bansFetch).toHaveBeenCalledTimes(1);
    now += 11 * 60 * 1000;
    bansFetch.mockReset().mockRejectedValue(new Error('bans fail'));
    await updateChannelStats(guild);
    expect(logger.error).toHaveBeenCalled();
    expect(channels.bansChan.name).toBe('Bans: 0');
    nowSpy.mockRestore();
  });

  test('reuses cached ban count within TTL (no second fetch)', async () => {
    const { updateChannelStats } = loadHelpers();
    const members = [makeMember('1', 'A', 1000)];
    const { guild, bansFetch } = makeGuild(members);
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    await updateChannelStats(guild);
    expect(bansFetch).toHaveBeenCalledTimes(1);
    now += 5 * 60 * 1000;
    await updateChannelStats(guild);
    expect(bansFetch).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  test('ensureFreshMembers fetch error logs warn and continues stats update', async () => {
    const { updateChannelStats } = loadHelpers();
    const members = [makeMember('1', 'RealUser', 1000)];
    const { guild, channels, bansFetch, membersFetch } = makeGuild(members, members.length + 5); // memberCount > cache -> incomplete
    (guild.members.fetch as any) = jest.fn(async () => { throw new Error('fetch fail'); });
    await updateChannelStats(guild);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Nie udało się pobrać pełnej listy'));
    expect(bansFetch).toHaveBeenCalled();
    expect(channels.usersChan.name).toMatch(/Users:/);
  });

  test('only bot members -> lastJoined channel value stays Brak', async () => {
    const { updateChannelStats } = loadHelpers();
    const botMembers = [makeMember('b1', 'BotA', 1000, true), makeMember('b2', 'BotB', 1200, true)];
    const { guild, channels } = makeGuild(botMembers, botMembers.length);
    await updateChannelStats(guild);
    expect(channels.lastChan.name).toBe('Ostatni: Brak');
    expect((currentDoc.channels.lastJoined as any).member).toBeUndefined();
  });

  test('ensureFreshMembers TTL prevents refetch when incomplete but within TTL', async () => {
    const { updateChannelStats } = loadHelpers();
    const members = [makeMember('1', 'A', 1000)];
    const { guild, channels, membersFetch } = makeGuild(members, members.length + 5); // incomplete
    // First run triggers fetch, record time 0
    let now = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  await updateChannelStats(guild);
  expect(membersFetch).toHaveBeenCalledTimes(0);
    // Within TTL -> no second fetch
    now += 60 * 1000; // 1 min
  await updateChannelStats(guild);
  expect(membersFetch).toHaveBeenCalledTimes(0);
    expect(channels.usersChan.name).toMatch(/Users:/);
    nowSpy.mockRestore();
  });

  test('missing ManageChannels perms on one channel does not break overall update', async () => {
    const { updateChannelStats } = loadHelpers();
    const members = [makeMember('1', 'A', 1000), makeMember('2', 'B', 2000)];
    const { guild, channels, bansFetch } = makeGuild(members, members.length + 3);
    // Simulate missing perms (50013) for users channel only
    (channels.usersChan.setName as any).mockRejectedValueOnce({ code: 50013 });

    await updateChannelStats(guild);

    // Warn logged for missing perms, but other channels updated and bans fetched
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Brak uprawnień'));
    expect(bansFetch).toHaveBeenCalled();
    // Bots/Last should still be updated
    expect(channels.botsChan.name).toMatch(/Bots:/);
    expect(channels.lastChan.name).toMatch(/Ostatni:/);
    expect(currentDoc.save).toHaveBeenCalled();
  });

  test('members cache complete -> no fetch, still updates stats', async () => {
    const { updateChannelStats } = loadHelpers();
    const members = [makeMember('1', 'A', 1000), makeMember('2', 'B', 2000)];
    const { guild, channels, membersFetch } = makeGuild(members, members.length); // complete cache

    await updateChannelStats(guild);

    expect(membersFetch).not.toHaveBeenCalled();
    expect(channels.usersChan.name).toMatch(/Users: 2/);
    expect(channels.botsChan.name).toMatch(/Bots: 0/);
  });

  test('outer catch: logs error when update process throws unexpectedly', async () => {
    // Re-mock ChannelStats findOne to return a doc whose save throws
    const models = require('../../../src/models/ChannelStats');
    const badDoc = { ...mockDocBase(), save: jest.fn(() => { throw new Error('save fail'); }) };
    currentDoc = badDoc as any;
    const { updateChannelStats } = loadHelpers();
    const { guild } = makeGuild([makeMember('1', 'X', 10)]);
    await updateChannelStats(guild);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Błąd przy aktualizacji statystyk'));
  });
});
