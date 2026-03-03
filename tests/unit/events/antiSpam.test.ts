/**
 * Tests for messageCreate/antiSpam handler.
 */

/* ── mocks (must be declared before imports) ─────────────── */

jest.mock('../../../src/services/antiSpamService', () => ({
  getConfig: jest.fn().mockResolvedValue({
    enabled: false,
    messageThreshold: 5,
    timeWindowMs: 3000,
    action: 'timeout',
    timeoutDurationMs: 300_000,
    deleteMessages: true,
    ignoredChannels: [],
    ignoredRoles: [],
    blockInviteLinks: false,
    blockMassMentions: false,
    maxMentionsPerMessage: 5,
    blockEveryoneHere: true,
    blockFlood: false,
    floodThreshold: 3,
    floodWindowMs: 30_000,
  }),
  trackMessage: jest.fn().mockReturnValue({ isSpam: false, messageCount: 1, settings: {} }),
  trackFlood: jest.fn().mockReturnValue({ isFlood: false, duplicateCount: 1, channels: [] }),
  clearUserHistory: jest.fn(),
  clearFloodHistory: jest.fn(),
  startCleanup: jest.fn(),
}));

jest.mock('../../../src/services/warnService', () => ({
  addWarn: jest.fn().mockResolvedValue({ ok: true, data: { count: 1, shouldBan: false, punishment: null, nextPunishment: null } }),
}));

jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { Collection, PermissionsBitField } from 'discord.js';
import { mockMessage, mockUser, mockGuildMember, mockClient, mockTextChannel, mockGuild } from '../../helpers/discordMocks';

import { getConfig, trackMessage, trackFlood, clearUserHistory, clearFloodHistory, startCleanup } from '../../../src/services/antiSpamService';
import { addWarn } from '../../../src/services/warnService';
import { sendLog } from '../../../src/utils/logHelpers';

let run: (message: any, client: any) => Promise<boolean | void>;

beforeAll(async () => {
  run = (await import('../../../src/events/messageCreate/antiSpam')).default;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: anti-spam disabled
  (getConfig as jest.Mock).mockResolvedValue({
    enabled: false,
    messageThreshold: 5,
    timeWindowMs: 3000,
    action: 'timeout',
    timeoutDurationMs: 300_000,
    deleteMessages: true,
    ignoredChannels: [],
    ignoredRoles: [],
    blockInviteLinks: false,
    blockMassMentions: false,
    maxMentionsPerMessage: 5,
    blockEveryoneHere: true,
    blockFlood: false,
    floodThreshold: 3,
    floodWindowMs: 30_000,
  });
  (trackMessage as jest.Mock).mockReturnValue({ isSpam: false, messageCount: 1, settings: {} });
});

/* ── Early returns ────────────────────────────────────────── */

describe('antiSpam handler — early returns', () => {
  it('ignores bot messages', async () => {
    const msg = mockMessage({ author: mockUser({ bot: true }) });
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(getConfig).not.toHaveBeenCalled();
  });

  it('ignores DMs (no guild)', async () => {
    const msg = mockMessage({ guild: null });
    msg.author.bot = false;
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(getConfig).not.toHaveBeenCalled();
  });

  it('ignores messages without member', async () => {
    const msg = mockMessage({ member: null });
    msg.author.bot = false;
    msg.guild = mockGuild();
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
  });

  it('returns early when anti-spam is disabled', async () => {
    const msg = mockMessage();
    msg.author.bot = false;
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(trackMessage).not.toHaveBeenCalled();
  });

  it('skips ignored channels', async () => {
    (getConfig as jest.Mock).mockResolvedValue({
      enabled: true,
      messageThreshold: 5,
      timeWindowMs: 3000,
      action: 'timeout',
      timeoutDurationMs: 300_000,
      deleteMessages: true,
      ignoredChannels: ['ch-1'],
      ignoredRoles: [],
      blockInviteLinks: false,
      blockMassMentions: false,
      maxMentionsPerMessage: 5,
      blockEveryoneHere: true,
      blockFlood: false,
      floodThreshold: 3,
      floodWindowMs: 30_000,
    });

    const msg = mockMessage();
    msg.author.bot = false;
    msg.channelId = 'ch-1';
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(trackMessage).not.toHaveBeenCalled();
  });

  it('skips members with ignored roles', async () => {
    (getConfig as jest.Mock).mockResolvedValue({
      enabled: true,
      messageThreshold: 5,
      timeWindowMs: 3000,
      action: 'timeout',
      timeoutDurationMs: 300_000,
      deleteMessages: true,
      ignoredChannels: [],
      ignoredRoles: ['role-mod'],
      blockInviteLinks: false,
      blockMassMentions: false,
      maxMentionsPerMessage: 5,
      blockEveryoneHere: true,
      blockFlood: false,
      floodThreshold: 3,
      floodWindowMs: 30_000,
    });

    const member = mockGuildMember();
    const rolesCache = new Collection<string, any>();
    rolesCache.set('role-mod', { id: 'role-mod' });
    member.roles.cache = rolesCache;

    const msg = mockMessage({ member });
    msg.author.bot = false;
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(trackMessage).not.toHaveBeenCalled();
  });

  it('skips administrators', async () => {
    (getConfig as jest.Mock).mockResolvedValue({
      enabled: true,
      messageThreshold: 5,
      timeWindowMs: 3000,
      action: 'timeout',
      timeoutDurationMs: 300_000,
      deleteMessages: true,
      ignoredChannels: [],
      ignoredRoles: [],
      blockInviteLinks: false,
      blockMassMentions: false,
      maxMentionsPerMessage: 5,
      blockEveryoneHere: true,
      blockFlood: false,
      floodThreshold: 3,
      floodWindowMs: 30_000,
    });

    const member = mockGuildMember();
    member.permissions = new PermissionsBitField([PermissionsBitField.Flags.Administrator]);

    const msg = mockMessage({ member });
    msg.author.bot = false;
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(trackMessage).not.toHaveBeenCalled();
  });
});

/* ── No spam ──────────────────────────────────────────────── */

describe('antiSpam handler — no spam', () => {
  it('tracks message and returns undefined when no spam', async () => {
    (getConfig as jest.Mock).mockResolvedValue({
      enabled: true,
      messageThreshold: 5,
      timeWindowMs: 3000,
      action: 'timeout',
      timeoutDurationMs: 300_000,
      deleteMessages: true,
      ignoredChannels: [],
      ignoredRoles: [],
      blockInviteLinks: false,
      blockMassMentions: false,
      maxMentionsPerMessage: 5,
      blockEveryoneHere: true,
      blockFlood: false,
      floodThreshold: 3,
      floodWindowMs: 30_000,
    });

    const member = mockGuildMember();
    member.permissions = new PermissionsBitField();

    const msg = mockMessage({ member });
    msg.author.bot = false;

    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(trackMessage).toHaveBeenCalled();
    expect(clearUserHistory).not.toHaveBeenCalled();
  });
});

/* ── Spam detected ────────────────────────────────────────── */

describe('antiSpam handler — spam detected', () => {
  const enabledConfig = {
    enabled: true,
    messageThreshold: 5,
    timeWindowMs: 3000,
    action: 'timeout' as const,
    timeoutDurationMs: 300_000,
    deleteMessages: true,
    ignoredChannels: [],
    ignoredRoles: [],
    blockInviteLinks: false,
    blockMassMentions: false,
    maxMentionsPerMessage: 5,
    blockEveryoneHere: true,
    blockFlood: false,
    floodThreshold: 3,
    floodWindowMs: 30_000,
  };

  function makeSpamMessage() {
    const guild = mockGuild();
    guild.members.me = mockGuildMember({ id: 'bot-id', highestPos: 99 });

    const member = mockGuildMember();
    member.permissions = new PermissionsBitField();
    member.moderatable = true;
    member.kickable = true;
    member.bannable = true;
    member.guild = guild;

    const channel = mockTextChannel();
    const fetchedMessages = new Collection<string, any>();
    fetchedMessages.set('m1', { author: { id: member.id }, delete: jest.fn() });
    fetchedMessages.set('m2', { author: { id: member.id }, delete: jest.fn() });
    fetchedMessages.set('m3', { author: { id: 'other-user' }, delete: jest.fn() });
    channel.messages = { fetch: jest.fn().mockResolvedValue(fetchedMessages) };
    channel.bulkDelete = jest.fn().mockResolvedValue(undefined);

    const msg = mockMessage({ guild, member, channel });
    msg.author = { id: member.id, tag: 'Spammer#0001', bot: false };

    return { msg, member, channel, guild };
  }

  beforeEach(() => {
    (getConfig as jest.Mock).mockResolvedValue(enabledConfig);
    (trackMessage as jest.Mock).mockReturnValue({
      isSpam: true,
      messageCount: 6,
      settings: enabledConfig,
    });
  });

  it('returns true to short-circuit the handler chain', async () => {
    const { msg } = makeSpamMessage();
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
  });

  it('clears user history after detection', async () => {
    const { msg } = makeSpamMessage();
    await run(msg, mockClient());
    expect(clearUserHistory).toHaveBeenCalledWith(msg.guild.id, msg.author.id);
  });

  it('deletes recent messages when deleteMessages=true', async () => {
    const { msg, channel } = makeSpamMessage();
    await run(msg, mockClient());
    expect(channel.messages.fetch).toHaveBeenCalledWith({ limit: 20 });
    expect(channel.bulkDelete).toHaveBeenCalled();
  });

  it('does not delete messages when deleteMessages=false', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...enabledConfig, deleteMessages: false });
    const { msg, channel } = makeSpamMessage();
    await run(msg, mockClient());
    expect(channel.bulkDelete).not.toHaveBeenCalled();
  });

  it('applies timeout when action=timeout', async () => {
    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());
    expect(member.timeout).toHaveBeenCalledWith(300_000, expect.any(String));
  });

  it('adds warn when action=warn', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...enabledConfig, action: 'warn' });
    (trackMessage as jest.Mock).mockReturnValue({
      isSpam: true,
      messageCount: 6,
      settings: { ...enabledConfig, action: 'warn' },
    });

    const { msg, member } = makeSpamMessage();
    const client = mockClient();
    await run(msg, client);
    expect(addWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: msg.guild.id,
        userId: member.id,
        reason: expect.stringContaining('Anti-Spam'),
      })
    );
    // Short timeout after warn
    expect(member.timeout).toHaveBeenCalledWith(60_000, expect.any(String));
  });

  it('kicks when action=kick', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...enabledConfig, action: 'kick' });
    (trackMessage as jest.Mock).mockReturnValue({
      isSpam: true,
      messageCount: 6,
      settings: { ...enabledConfig, action: 'kick' },
    });

    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());
    expect(member.kick).toHaveBeenCalledWith(expect.stringContaining('Anti-Spam'));
  });

  it('bans when action=ban', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...enabledConfig, action: 'ban' });
    (trackMessage as jest.Mock).mockReturnValue({
      isSpam: true,
      messageCount: 6,
      settings: { ...enabledConfig, action: 'ban' },
    });

    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());
    expect(member.ban).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining('Anti-Spam') })
    );
  });

  it('sends a log to the guild log channel', async () => {
    const { msg } = makeSpamMessage();
    const client = mockClient();
    await run(msg, client);
    expect(sendLog).toHaveBeenCalledWith(
      client,
      msg.guild.id,
      'antiSpam',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });
});

/* ── Invite link blocking ─────────────────────────────────── */

describe('antiSpam handler — invite link blocking', () => {
  const inviteConfig = {
    enabled: true,
    messageThreshold: 5,
    timeWindowMs: 3000,
    action: 'timeout' as const,
    timeoutDurationMs: 300_000,
    deleteMessages: true,
    ignoredChannels: [],
    ignoredRoles: [],
    blockInviteLinks: true,
    blockMassMentions: false,
    maxMentionsPerMessage: 5,
    blockEveryoneHere: true,
    blockFlood: false,
    floodThreshold: 3,
    floodWindowMs: 30_000,
  };

  function makeInviteMessage(content: string) {
    const guild = mockGuild({ id: 'current-guild' });
    guild.members.me = mockGuildMember({ id: 'bot-id', highestPos: 99 });

    const member = mockGuildMember();
    member.permissions = new PermissionsBitField();
    member.moderatable = true;
    member.guild = guild;

    const channel = mockTextChannel();
    const msg = mockMessage({ guild, member, channel, content });
    msg.author = { id: member.id, tag: 'Inviter#0001', bot: false };
    msg.channelId = channel.id;

    return { msg, member, channel, guild };
  }

  beforeEach(() => {
    (getConfig as jest.Mock).mockResolvedValue(inviteConfig);
    (trackMessage as jest.Mock).mockReturnValue({ isSpam: false, messageCount: 1, settings: inviteConfig });
  });

  it('blocks discord.gg invite to another server', async () => {
    const { msg } = makeInviteMessage('Join my server! https://discord.gg/abc123');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({
      guild: { id: 'other-guild', name: 'Other Server' },
    });

    const result = await run(msg, client);
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
    expect(sendLog).toHaveBeenCalledWith(
      client,
      'current-guild',
      'antiSpam',
      expect.objectContaining({ title: '🛡️ Zablokowane zaproszenie' }),
    );
  });

  it('blocks discord.com/invite link to another server', async () => {
    const { msg } = makeInviteMessage('Check this out https://discord.com/invite/xyz789');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({
      guild: { id: 'other-guild', name: 'Other Server' },
    });

    const result = await run(msg, client);
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
  });

  it('blocks discordapp.com/invite link to another server', async () => {
    const { msg } = makeInviteMessage('https://discordapp.com/invite/test456');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({
      guild: { id: 'other-guild', name: 'Other Server' },
    });

    const result = await run(msg, client);
    expect(result).toBe(true);
  });

  it('allows invite to the same server', async () => {
    const { msg } = makeInviteMessage('Share this: https://discord.gg/ourserver');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({
      guild: { id: 'current-guild', name: 'Our Server' },
    });

    const result = await run(msg, client);
    // Not blocked — falls through to spam tracking which returns false
    expect(result).toBeUndefined();
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it('ignores expired/invalid invites', async () => {
    const { msg } = makeInviteMessage('https://discord.gg/expired');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockRejectedValue(new Error('Unknown Invite'));

    const result = await run(msg, client);
    expect(result).toBeUndefined();
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it('ignores messages without invite links', async () => {
    const { msg } = makeInviteMessage('Hello, just chatting!');

    const client = mockClient();
    client.fetchInvite = jest.fn();

    const result = await run(msg, client);
    expect(result).toBeUndefined();
    expect(client.fetchInvite).not.toHaveBeenCalled();
  });

  it('does not check invites when blockInviteLinks=false', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...inviteConfig, blockInviteLinks: false });

    const { msg } = makeInviteMessage('https://discord.gg/abc123');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({
      guild: { id: 'other-guild', name: 'Other Server' },
    });

    const result = await run(msg, client);
    expect(result).toBeUndefined();
    expect(client.fetchInvite).not.toHaveBeenCalled();
  });

  it('applies configured action on blocked invite', async () => {
    const { msg, member } = makeInviteMessage('https://discord.gg/abc123');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({
      guild: { id: 'other-guild', name: 'Other Server' },
    });

    await run(msg, client);
    expect(member.timeout).toHaveBeenCalledWith(300_000, expect.any(String));
  });
});

/* ── Mass mention blocking ────────────────────────────────── */

describe('antiSpam handler — mass mention blocking', () => {
  const mentionConfig = {
    enabled: true,
    messageThreshold: 5,
    timeWindowMs: 3000,
    action: 'timeout' as const,
    timeoutDurationMs: 300_000,
    deleteMessages: true,
    ignoredChannels: [],
    ignoredRoles: [],
    blockInviteLinks: false,
    blockMassMentions: true,
    maxMentionsPerMessage: 5,
    blockEveryoneHere: true,
    blockFlood: false,
    floodThreshold: 3,
    floodWindowMs: 30_000,
  };

  function makeMentionMessage(opts: {
    userMentions?: number;
    roleMentions?: number;
    everyone?: boolean;
  } = {}) {
    const guild = mockGuild({ id: 'guild-mention' });
    guild.members.me = mockGuildMember({ id: 'bot-id', highestPos: 99 });

    const member = mockGuildMember();
    member.permissions = new PermissionsBitField();
    member.moderatable = true;
    member.guild = guild;

    const channel = mockTextChannel();
    const msg = mockMessage({ guild, member, channel, content: 'ping ping' });
    msg.author = { id: member.id, tag: 'Pinger#0001', bot: false };
    msg.channelId = channel.id;

    // Build mentions mock
    const users = new Collection<string, any>();
    for (let i = 0; i < (opts.userMentions ?? 0); i++) {
      users.set(`u${i}`, { id: `u${i}` });
    }
    const roles = new Collection<string, any>();
    for (let i = 0; i < (opts.roleMentions ?? 0); i++) {
      roles.set(`r${i}`, { id: `r${i}` });
    }
    msg.mentions = {
      users,
      roles,
      everyone: opts.everyone ?? false,
    };

    return { msg, member, channel, guild };
  }

  beforeEach(() => {
    (getConfig as jest.Mock).mockResolvedValue(mentionConfig);
    (trackMessage as jest.Mock).mockReturnValue({ isSpam: false, messageCount: 1, settings: mentionConfig });
  });

  it('blocks @everyone mention', async () => {
    const { msg } = makeMentionMessage({ everyone: true });
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
    expect(sendLog).toHaveBeenCalledWith(
      expect.anything(),
      'guild-mention',
      'antiSpam',
      expect.objectContaining({ title: '🛡️ Zablokowane wzmianki' }),
    );
  });

  it('blocks when user mentions exceed maxMentionsPerMessage', async () => {
    const { msg } = makeMentionMessage({ userMentions: 6 });
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
  });

  it('blocks when role mentions exceed maxMentionsPerMessage', async () => {
    const { msg } = makeMentionMessage({ roleMentions: 6 });
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
  });

  it('blocks when combined user+role mentions exceed threshold', async () => {
    const { msg } = makeMentionMessage({ userMentions: 3, roleMentions: 3 });
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
  });

  it('allows mentions at or below the threshold', async () => {
    const { msg } = makeMentionMessage({ userMentions: 5 });
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it('allows messages without mentions', async () => {
    const { msg } = makeMentionMessage();
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
  });

  it('does not check when blockMassMentions=false', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...mentionConfig, blockMassMentions: false });
    const { msg } = makeMentionMessage({ everyone: true, userMentions: 10 });
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it('allows @everyone when blockEveryoneHere=false', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...mentionConfig, blockEveryoneHere: false });
    const { msg } = makeMentionMessage({ everyone: true, userMentions: 0 });
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
  });

  it('applies configured action on blocked mention', async () => {
    const { msg, member } = makeMentionMessage({ userMentions: 10 });
    await run(msg, mockClient());
    expect(member.timeout).toHaveBeenCalledWith(300_000, expect.any(String));
  });

  it('respects custom maxMentionsPerMessage', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...mentionConfig, maxMentionsPerMessage: 2 });
    const { msg } = makeMentionMessage({ userMentions: 3 });
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
  });
});

/* ── flood detection ─────────────────────────────────────── */

describe('antiSpam handler — flood detection', () => {
  const floodConfig = {
    enabled: true,
    messageThreshold: 5,
    timeWindowMs: 3000,
    action: 'timeout' as const,
    timeoutDurationMs: 300_000,
    deleteMessages: true,
    ignoredChannels: [],
    ignoredRoles: [],
    blockInviteLinks: false,
    blockMassMentions: false,
    maxMentionsPerMessage: 5,
    blockEveryoneHere: true,
    blockFlood: true,
    floodThreshold: 3,
    floodWindowMs: 30_000,
  };

  function makeFloodMessage(content = 'spam everywhere') {
    const guild = mockGuild();
    guild.members.me = mockGuildMember({ id: 'bot-id', highestPos: 99 });

    const member = mockGuildMember();
    member.permissions = new PermissionsBitField();
    member.moderatable = true;
    member.kickable = true;
    member.bannable = true;
    member.guild = guild;

    const channel = mockTextChannel(guild);
    const messagesMap = new Collection<string, any>();
    (channel.messages as any) = { fetch: jest.fn().mockResolvedValue(messagesMap) };

    const msg = mockMessage({ member, guild, channel });
    msg.author = { id: member.id, tag: 'Flooder#0001', bot: false };
    msg.content = content;
    msg.channelId = 'ch-flood';
    msg.deletable = true;

    return { msg, member, channel };
  }

  beforeEach(() => {
    (getConfig as jest.Mock).mockResolvedValue(floodConfig);
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: false, duplicateCount: 1, channels: [] });
    (trackMessage as jest.Mock).mockReturnValue({ isSpam: false, messageCount: 1, settings: floodConfig });
  });

  it('blocks message when flood is detected', async () => {
    (trackFlood as jest.Mock).mockReturnValue({
      isFlood: true,
      duplicateCount: 3,
      channels: ['ch-1', 'ch-2', 'ch-3'],
    });

    const { msg, member } = makeFloodMessage();
    const result = await run(msg, mockClient());

    expect(result).toBe(true);
    expect(clearFloodHistory).toHaveBeenCalled();
    expect(member.timeout).toHaveBeenCalledWith(300_000, expect.any(String));
    expect(sendLog).toHaveBeenCalled();
  });

  it('does not block when flood threshold not reached', async () => {
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: false, duplicateCount: 2, channels: ['ch-1', 'ch-2'] });

    const { msg } = makeFloodMessage();
    const result = await run(msg, mockClient());

    expect(result).toBeUndefined();
    expect(clearFloodHistory).not.toHaveBeenCalled();
  });

  it('skips flood check when blockFlood is disabled', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...floodConfig, blockFlood: false });
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 5, channels: [] });

    const { msg } = makeFloodMessage();
    const result = await run(msg, mockClient());

    // Should not be blocked by flood (may still go through rate-limit check)
    expect(clearFloodHistory).not.toHaveBeenCalled();
  });

  it('skips flood check for empty messages', async () => {
    const { msg } = makeFloodMessage('');
    const result = await run(msg, mockClient());

    expect(trackFlood).not.toHaveBeenCalled();
  });

  it('deletes message on flood when deleteMessages=true', async () => {
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 3, channels: ['ch-1'] });

    const { msg } = makeFloodMessage();
    msg.deletable = true;
    const result = await run(msg, mockClient());

    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
  });

  it('applies ban action on flood', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...floodConfig, action: 'ban' });
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 3, channels: ['ch-1', 'ch-2', 'ch-3'] });

    const { msg, member } = makeFloodMessage();
    await run(msg, mockClient());

    expect(member.ban).toHaveBeenCalledWith({ reason: expect.any(String), deleteMessageSeconds: 60 });
  });

  it('applies kick action on flood', async () => {
    (getConfig as jest.Mock).mockResolvedValue({ ...floodConfig, action: 'kick' });
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 3, channels: ['ch-1', 'ch-2', 'ch-3'] });

    const { msg, member } = makeFloodMessage();
    await run(msg, mockClient());

    expect(member.kick).toHaveBeenCalledWith(expect.any(String));
  });
});