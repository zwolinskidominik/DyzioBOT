jest.mock('../../../src/models/ChannelStats', () => ({
  ChannelStatsModel: { findOne: jest.fn() },
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { safeSetChannelName, updateChannelName, updateChannelStats } from '../../../src/utils/channelHelpers';
import { ChannelStatsModel } from '../../../src/models/ChannelStats';
import { Collection } from 'discord.js';

/* ── helpers ─────────────────────────────────────────── */
let channelIdSeq = 0;
function makeChannel(name = 'old-name', id?: string): any {
  return {
    id: id ?? `ch${++channelIdSeq}`,
    name,
    setName: jest.fn().mockResolvedValue(undefined),
  };
}

function makeGuild(channels: any[] = [], members: any[] = [], bans: any[] = []): any {
  const channelCache = new Collection<string, any>();
  for (const c of channels) channelCache.set(c.id, c);

  const memberCache = new Collection<string, any>();
  for (const m of members) memberCache.set(m.id, m);

  return {
    id: 'g1',
    memberCount: members.length + 5, // make memberCount > cache to trigger fetch
    channels: { cache: channelCache },
    members: {
      cache: memberCache,
      fetch: jest.fn().mockResolvedValue(memberCache),
    },
    bans: {
      fetch: jest.fn().mockResolvedValue(new Collection(bans.map(b => [b.id ?? b, b]))),
    },
  };
}

/* ── safeSetChannelName ──────────────────────────────── */
describe('safeSetChannelName', () => {
  beforeEach(() => { channelIdSeq = 0; });

  it('skips when name is already the same', async () => {
    const ch = makeChannel('same');
    await safeSetChannelName(ch, 'same');
    expect(ch.setName).not.toHaveBeenCalled();
  });

  it('calls setName with new name', async () => {
    const ch = makeChannel('old');
    await safeSetChannelName(ch, 'new-name');
    expect(ch.setName).toHaveBeenCalledWith('new-name');
  });

  it('retries on rate limit (httpStatus 429)', async () => {
    jest.useFakeTimers();
    const ch = makeChannel('old');
    let call = 0;
    ch.setName = jest.fn().mockImplementation(() => {
      if (call++ < 1) {
        const err: any = new Error('rate limit');
        err.httpStatus = 429;
        return Promise.reject(err);
      }
      return Promise.resolve();
    });

    const p = safeSetChannelName(ch, 'new', 3, 100);
    // flush timers to allow retry setTimeout
    await jest.advanceTimersByTimeAsync(200);
    await p;
    expect(ch.setName).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('gives up on permission error (code 50013)', async () => {
    const ch = makeChannel('old');
    const err: any = new Error('Missing Access');
    err.code = 50013;
    ch.setName = jest.fn().mockRejectedValue(err);

    // Should not throw
    await expect(safeSetChannelName(ch, 'new')).resolves.toBeUndefined();
    expect(ch.setName).toHaveBeenCalledTimes(1);
  });

  it('throws on unknown error', async () => {
    const ch = makeChannel('old');
    ch.setName = jest.fn().mockRejectedValue(new Error('unknown'));
    await expect(safeSetChannelName(ch, 'new', 0)).rejects.toThrow('unknown');
  });
});

/* ── updateChannelName ───────────────────────────────── */
describe('updateChannelName', () => {
  it('returns early when config is undefined', async () => {
    const guild = makeGuild();
    await updateChannelName(guild, undefined, 42);
    // no error
  });

  it('returns early when channelConfig has no channelId', async () => {
    const guild = makeGuild();
    await updateChannelName(guild, {}, 42);
  });

  it('returns early when channel not found in cache', async () => {
    const guild = makeGuild();
    await updateChannelName(guild, { channelId: 'missing' }, 42);
  });

  it('calls safeSetChannelName with template-replaced name', async () => {
    const ch = makeChannel('old');
    const guild = makeGuild([ch]);
    await updateChannelName(guild, { channelId: ch.id, template: 'Members: {count}' }, 42);
    expect(ch.setName).toHaveBeenCalledWith('Members: 42');
  });

  it('uses value directly when no template', async () => {
    const ch = makeChannel('old');
    const guild = makeGuild([ch]);
    await updateChannelName(guild, { channelId: ch.id }, 99);
    expect(ch.setName).toHaveBeenCalledWith('99');
  });

  it('template supports multiple placeholder styles', async () => {
    const ch = makeChannel('old');
    const guild = makeGuild([ch]);
    await updateChannelName(guild, { channelId: ch.id, template: '{count} <value> {member}' }, 7);
    expect(ch.setName).toHaveBeenCalledWith('7 7 7');
  });

  it('truncates result to 100 chars', async () => {
    const ch = makeChannel('old');
    const guild = makeGuild([ch]);
    const longTemplate = 'A'.repeat(110); // no placeholder, just 110 chars
    await updateChannelName(guild, { channelId: ch.id, template: longTemplate }, 1);
    expect(ch.setName).toHaveBeenCalledWith('A'.repeat(100));
  });
});

/* ── updateChannelStats ──────────────────────────────── */
describe('updateChannelStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns early when no channel stats doc', async () => {
    (ChannelStatsModel.findOne as jest.Mock).mockResolvedValue(null);
    const guild = makeGuild();
    await updateChannelStats(guild);
    // no channels updated
  });

  it('updates user/bot/ban channel names', async () => {
    const userCh = makeChannel('users: 0', 'uch');
    const botCh = makeChannel('bots: 0', 'bch');
    const banCh = makeChannel('bans: 0', 'banch');

    const members = [
      { id: 'm1', user: { bot: false }, joinedTimestamp: 100 },
      { id: 'm2', user: { bot: true }, joinedTimestamp: 200 },
    ];

    const guild = makeGuild([userCh, botCh, banCh], members, [{ id: 'b1' }]);

    (ChannelStatsModel.findOne as jest.Mock).mockResolvedValue({
      guildId: 'g1',
      channels: {
        users: { channelId: 'uch', template: 'Users: {count}' },
        bots: { channelId: 'bch', template: 'Bots: {count}' },
        bans: { channelId: 'banch', template: 'Bans: {count}' },
      },
      save: jest.fn().mockResolvedValue(undefined),
    });

    await updateChannelStats(guild);

    expect(userCh.setName).toHaveBeenCalledWith('Users: 1');
    expect(botCh.setName).toHaveBeenCalledWith('Bots: 1');
    expect(banCh.setName).toHaveBeenCalledWith('Bans: 1');
  });
});
