/* ── Mocks ───────────────────────────────────────────────────── */

jest.mock('../../../src/cache/inviteCache', () => ({
  detectUsedInvite: jest.fn(),
  cacheAllGuildInvites: jest.fn(),
  cacheGuildInvites: jest.fn(),
}));

jest.mock('../../../src/services/inviteTrackerService', () => ({
  getConfig: jest.fn(),
  recordJoin: jest.fn(),
  recordLeave: jest.fn(),
  getInviterStats: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import { detectUsedInvite, cacheAllGuildInvites } from '../../../src/cache/inviteCache';
import {
  getConfig,
  recordJoin,
  recordLeave,
  getInviterStats,
} from '../../../src/services/inviteTrackerService';

import inviteTrackerJoin from '../../../src/events/guildMemberAdd/inviteTracker';
import inviteTrackerLeave from '../../../src/events/guildMemberRemove/inviteTracker';
import inviteCacheStartup from '../../../src/events/clientReady/inviteCache';

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockRecordJoin = recordJoin as jest.MockedFunction<typeof recordJoin>;
const mockRecordLeave = recordLeave as jest.MockedFunction<typeof recordLeave>;
const mockGetInviterStats = getInviterStats as jest.MockedFunction<typeof getInviterStats>;
const mockDetectUsedInvite = detectUsedInvite as jest.MockedFunction<typeof detectUsedInvite>;
const mockCacheAllGuildInvites = cacheAllGuildInvites as jest.MockedFunction<typeof cacheAllGuildInvites>;

/* ── Helpers ──────────────────────────────────────────────────── */

function makeMember(overrides: Partial<any> = {}) {
  const send = jest.fn();
  return {
    id: 'member-1',
    user: {
      id: 'member-1',
      tag: 'TestUser#0001',
      username: 'TestUser',
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days old
      displayAvatarURL: jest.fn().mockReturnValue('https://cdn.discord.com/avatar.png'),
    },
    guild: {
      id: 'guild-1',
      name: 'Test Server',
      memberCount: 100,
      invites: {
        fetch: jest.fn().mockResolvedValue(new Map()),
      },
      channels: {
        cache: new Map([
          ['log-ch', {
            id: 'log-ch',
            send,
          }],
        ]),
      },
    },
    ...overrides,
  };
}

function makeClient() {
  return {
    guilds: {
      cache: new Map([
        ['guild-1', {
          id: 'guild-1',
          name: 'Test Guild',
          invites: { fetch: jest.fn().mockResolvedValue(new Map()) },
        }],
      ]),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

/* ── clientReady/inviteCache.ts ───────────────────────────────── */

describe('clientReady/inviteCache', () => {
  it('calls cacheAllGuildInvites on startup', async () => {
    mockCacheAllGuildInvites.mockResolvedValue(undefined);
    const client = makeClient();
    await inviteCacheStartup(client as any);
    expect(mockCacheAllGuildInvites).toHaveBeenCalledWith(client);
  });

  it('handles errors gracefully', async () => {
    mockCacheAllGuildInvites.mockRejectedValue(new Error('fetch failed'));
    const client = makeClient();
    await expect(inviteCacheStartup(client as any)).resolves.not.toThrow();
  });
});

/* ── guildMemberAdd/inviteTracker.ts ──────────────────────────── */

describe('guildMemberAdd/inviteTracker', () => {
  it('does nothing when module is disabled', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: false, logChannelId: null, joinMessage: '', leaveMessage: '' } });
    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);
    expect(mockRecordJoin).not.toHaveBeenCalled();
  });

  it('records join when enabled', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: true, logChannelId: null, joinMessage: '', leaveMessage: '' } });
    mockDetectUsedInvite.mockResolvedValue({ code: 'abc123', inviterId: 'inviter-1' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inviter-1', fake: false } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    expect(mockRecordJoin).toHaveBeenCalledWith(expect.objectContaining({
      guildId: 'guild-1',
      joinedUserId: 'member-1',
      inviterId: 'inviter-1',
      inviteCode: 'abc123',
    }));
  });

  it('sends default embed to log channel', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: true, logChannelId: 'log-ch', joinMessage: '', leaveMessage: '' } });
    mockDetectUsedInvite.mockResolvedValue({ code: 'abc', inviterId: 'inv-1' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', fake: false } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', total: 5, active: 3, left: 1, fake: 1 } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.any(Array),
    }));
  });

  it('sends custom join message when configured', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: true, logChannelId: 'log-ch', joinMessage: 'Witaj {user}! Zaproszony przez {inviter}', leaveMessage: '' } });
    mockDetectUsedInvite.mockResolvedValue({ code: 'abc', inviterId: 'inv-1' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', fake: false } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', total: 1, active: 1, left: 0, fake: 0 } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('Witaj <@member-1>! Zaproszony przez <@inv-1>');
  });

  it('replaces {activeCount} with the number of active invites', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: true, logChannelId: 'log-ch', joinMessage: '{user} zaproszony przez {inviter}, ma {activeCount} zaproszeń!', leaveMessage: '' } });
    mockDetectUsedInvite.mockResolvedValue({ code: 'xyz', inviterId: 'inv-2' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inv-2', fake: false } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'inv-2', total: 340, active: 334, left: 4, fake: 2 } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('<@member-1> zaproszony przez <@inv-2>, ma 334 zaproszeń!');
  });

  it('does nothing when guild is missing', async () => {
    const member = makeMember({ guild: undefined });
    await inviteTrackerJoin(member as any, {} as any);
    expect(mockGetConfig).not.toHaveBeenCalled();
  });

  it('handles null invite detection gracefully', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: true, logChannelId: 'log-ch', joinMessage: '', leaveMessage: '' } });
    mockDetectUsedInvite.mockResolvedValue(null);
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: null, fake: false } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    expect(mockRecordJoin).toHaveBeenCalledWith(expect.objectContaining({
      inviterId: null,
      inviteCode: null,
    }));
  });
});

/* ── guildMemberRemove/inviteTracker.ts ───────────────────────── */

describe('guildMemberRemove/inviteTracker', () => {
  it('does nothing when module is disabled', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: false, logChannelId: null, joinMessage: '', leaveMessage: '' } });
    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);
    expect(mockRecordLeave).not.toHaveBeenCalled();
  });

  it('records leave and sends embed', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: true, logChannelId: 'log-ch', joinMessage: '', leaveMessage: '' } });
    mockRecordLeave.mockResolvedValue({ ok: true, data: { inviterId: 'inviter-1' } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'inviter-1', total: 3, active: 2, left: 1, fake: 0 } });

    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);

    expect(mockRecordLeave).toHaveBeenCalledWith('guild-1', 'member-1');

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.any(Array),
    }));
  });

  it('sends custom leave message', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: true, logChannelId: 'log-ch', joinMessage: '', leaveMessage: '{user} opuścił {server}!' } });
    mockRecordLeave.mockResolvedValue({ ok: true, data: { inviterId: null } });

    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('<@member-1> opuścił Test Server!');
  });

  it('skips log when no log channel configured', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: { enabled: true, logChannelId: null, joinMessage: '', leaveMessage: '' } });
    mockRecordLeave.mockResolvedValue({ ok: true, data: { inviterId: null } });

    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);

    expect(mockRecordLeave).toHaveBeenCalled();
    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).not.toHaveBeenCalled();
  });
});
