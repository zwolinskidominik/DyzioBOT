/* ── Mocks ───────────────────────────────────────────────────── */

jest.mock('../../../src/cache/inviteCache', () => ({
  detectUsedInvite: jest.fn(),
  cacheAllGuildInvites: jest.fn(),
  cacheGuildInvites: jest.fn(),
}));

jest.mock('../../../src/services/inviteTrackerService', () => {
  const actual = jest.requireActual('../../../src/services/inviteTrackerService');
  return {
    ...actual,
    getConfig: jest.fn(),
    recordJoin: jest.fn(),
    recordLeave: jest.fn(),
    getInviterStats: jest.fn(),
  };
});

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
  InviteTrackerConfigData,
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

/** Buduje pełny config (join+leave) z rozsądnymi domyślnymi wartościami, nadpisywalny per test. */
function makeConfig(overrides: {
  enabled?: boolean;
  join?: Partial<InviteTrackerConfigData['join']>;
  leave?: Partial<InviteTrackerConfigData['leave']>;
} = {}): InviteTrackerConfigData {
  return {
    enabled: overrides.enabled ?? true,
    join: {
      enabled: true,
      logChannelId: 'log-ch',
      embed: false,
      embedColor: '',
      messages: { normal: '', selfInvite: '', unknown: '', vanity: '', botAdd: '' },
      ...overrides.join,
    },
    leave: {
      enabled: true,
      logChannelId: 'log-ch',
      embed: false,
      embedColor: '',
      messages: { normal: '', unknown: '', vanity: '', botRemove: '' },
      ...overrides.leave,
    },
  };
}

function makeMember(overrides: Partial<any> = {}) {
  const send = jest.fn();
  return {
    id: 'member-1',
    displayName: 'TestUser',
    user: {
      id: 'member-1',
      tag: 'TestUser#0001',
      username: 'TestUser',
      bot: false,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days old
      displayAvatarURL: jest.fn().mockReturnValue('https://cdn.discord.com/avatar.png'),
    },
    guild: {
      id: 'guild-1',
      name: 'Test Server',
      memberCount: 100,
      vanityURLCode: null,
      invites: {
        fetch: jest.fn().mockResolvedValue(new Map()),
      },
      members: {
        fetch: jest.fn().mockResolvedValue({ displayName: 'Inviter', id: 'inv-1' }),
      },
      fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { find: () => undefined } }),
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
  it('does nothing when module is globally disabled', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ enabled: false }) });
    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);
    expect(mockRecordJoin).not.toHaveBeenCalled();
  });

  it('records join when enabled (tracking happens even if section is off)', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig() });
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

  it('sends default template text (normal) when known inviter and no custom message', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig() });
    mockDetectUsedInvite.mockResolvedValue({ code: 'abc', inviterId: 'inv-1' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', fake: false } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', total: 5, active: 3, left: 1, fake: 1 } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('**<@member-1>** został zaproszony przez **Inviter**, który/a ma teraz **3 zaproszeń**!');
  });

  it('sends custom join message when configured', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ join: { messages: { normal: 'Witaj {memberMention}! Zaproszony przez {inviterName}', selfInvite: '', unknown: '', vanity: '', botAdd: '' } } }) });
    mockDetectUsedInvite.mockResolvedValue({ code: 'abc', inviterId: 'inv-1' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', fake: false } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', total: 1, active: 1, left: 0, fake: 0 } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('Witaj <@member-1>! Zaproszony przez Inviter');
  });

  it('replaces {inviteCount} (and legacy {activeCount}) with the number of active invites', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ join: { messages: { normal: '{memberMention} zaproszony przez {inviterName}, ma {activeCount} zaproszeń!', selfInvite: '', unknown: '', vanity: '', botAdd: '' } } }) });
    mockDetectUsedInvite.mockResolvedValue({ code: 'xyz', inviterId: 'inv-2' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inv-2', fake: false } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'inv-2', total: 340, active: 334, left: 4, fake: 2 } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('<@member-1> zaproszony przez Inviter, ma 334 zaproszeń!');
  });

  it('does nothing when guild is missing', async () => {
    const member = makeMember({ guild: undefined });
    await inviteTrackerJoin(member as any, {} as any);
    expect(mockGetConfig).not.toHaveBeenCalled();
  });

  it('handles null invite detection gracefully', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig() });
    mockDetectUsedInvite.mockResolvedValue(null);
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: null, fake: false } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    expect(mockRecordJoin).toHaveBeenCalledWith(expect.objectContaining({
      inviterId: null,
      inviteCode: null,
    }));
  });

  it('uses the "unknown" situation template when inviter cannot be determined', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ join: { messages: { normal: 'known', selfInvite: '', unknown: '{memberName} dołączył, ale nie wiadomo kto zaprosił', vanity: '' , botAdd: ''} } }) });
    mockDetectUsedInvite.mockResolvedValue(null);
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: null, fake: false } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('TestUser dołączył, ale nie wiadomo kto zaprosił');
  });

  it('uses the "vanity" situation template when vanity URL is used', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ join: { messages: { normal: 'known', selfInvite: '', unknown: 'unknown', vanity: '{memberName} dołączył przez vanity {inviteCode}', botAdd: '' } } }) });
    mockDetectUsedInvite.mockResolvedValue({ code: 'myserver', inviterId: null });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: null, fake: false } });

    const member = makeMember({
      guild: {
        id: 'guild-1',
        name: 'Test Server',
        memberCount: 100,
        vanityURLCode: 'myserver',
        invites: { fetch: jest.fn().mockResolvedValue(new Map()) },
        members: { fetch: jest.fn().mockResolvedValue(null) },
        fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { find: () => undefined } }),
        channels: {
          cache: new Map([['log-ch', { id: 'log-ch', send: jest.fn() }]]),
        },
      },
    });
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('TestUser dołączył przez vanity myserver');
  });

  it('uses the "selfInvite" situation when the inviter is the joining member', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ join: { messages: { normal: 'known', selfInvite: '{memberName} zaprosił się sam', unknown: '', vanity: '', botAdd: '' } } }) });
    mockDetectUsedInvite.mockResolvedValue({ code: 'self-code', inviterId: 'member-1' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'member-1', fake: false } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'member-1', total: 1, active: 1, left: 0, fake: 0 } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('TestUser zaprosił się sam');
  });

  it('uses the "botAdd" situation and skips invite detection/recordJoin when a bot is added', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ join: { messages: { normal: '', selfInvite: '', unknown: '', vanity: '', botAdd: '{memberName} to bot!' } } }) });

    const member = makeMember({ user: { id: 'member-1', tag: 'Bot#0000', username: 'MusicBot', bot: true, createdAt: new Date() } });
    await inviteTrackerJoin(member as any, {} as any);

    expect(mockRecordJoin).not.toHaveBeenCalled();
    expect(mockDetectUsedInvite).not.toHaveBeenCalled();
    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('MusicBot to bot!');
  });

  it('sends nothing when join section is disabled, even though the module is enabled', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ join: { enabled: false } }) });
    mockDetectUsedInvite.mockResolvedValue({ code: 'abc', inviterId: 'inv-1' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', fake: false } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    expect(mockRecordJoin).toHaveBeenCalled();
    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).not.toHaveBeenCalled();
  });

  it('sends as embed when join.embed is true', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ join: { embed: true } }) });
    mockDetectUsedInvite.mockResolvedValue({ code: 'abc', inviterId: 'inv-1' });
    mockRecordJoin.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', fake: false } });
    mockGetInviterStats.mockResolvedValue({ ok: true, data: { inviterId: 'inv-1', total: 1, active: 1, left: 0, fake: 0 } });

    const member = makeMember();
    await inviteTrackerJoin(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
  });
});

/* ── guildMemberRemove/inviteTracker.ts ───────────────────────── */

describe('guildMemberRemove/inviteTracker', () => {
  it('does nothing when module is globally disabled', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ enabled: false }) });
    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);
    expect(mockRecordLeave).not.toHaveBeenCalled();
  });

  it('records leave and sends the default "normal" template', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig() });
    mockRecordLeave.mockResolvedValue({ ok: true, data: { inviterId: 'inviter-1', inviteCode: 'abc' } });

    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);

    expect(mockRecordLeave).toHaveBeenCalledWith('guild-1', 'member-1');

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('**TestUser** opuścił serwer. Zaprosił go **Inviter**.');
  });

  it('sends custom leave message', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ leave: { messages: { normal: '{memberName} opuścił serwer!', unknown: '', vanity: '', botRemove: '' } } }) });
    mockRecordLeave.mockResolvedValue({ ok: true, data: { inviterId: null, inviteCode: null } });

    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('TestUser opuścił serwer!');
  });

  it('uses "unknown" template when inviter is unknown', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ leave: { messages: { normal: 'known', unknown: '{memberName} odszedł bez znanego zapraszającego', vanity: '', botRemove: '' } } }) });
    mockRecordLeave.mockResolvedValue({ ok: true, data: { inviterId: null, inviteCode: null } });

    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);

    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('TestUser odszedł bez znanego zapraszającego');
  });

  it('uses "botRemove" template and skips recordLeave when a bot leaves', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ leave: { messages: { normal: '', unknown: '', vanity: '', botRemove: '{memberName} to był bot' } } }) });

    const member = makeMember({ user: { id: 'member-1', tag: 'Bot#0000', username: 'MusicBot', bot: true, createdAt: new Date() } });
    await inviteTrackerLeave(member as any, {} as any);

    expect(mockRecordLeave).not.toHaveBeenCalled();
    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).toHaveBeenCalledWith('MusicBot to był bot');
  });

  it('skips log when no log channel configured', async () => {
    mockGetConfig.mockResolvedValue({ ok: true, data: makeConfig({ leave: { logChannelId: null } }) });
    mockRecordLeave.mockResolvedValue({ ok: true, data: { inviterId: null, inviteCode: null } });

    const member = makeMember();
    await inviteTrackerLeave(member as any, {} as any);

    expect(mockRecordLeave).toHaveBeenCalled();
    const logChannel = member.guild.channels.cache.get('log-ch');
    expect(logChannel!.send).not.toHaveBeenCalled();
  });
});
