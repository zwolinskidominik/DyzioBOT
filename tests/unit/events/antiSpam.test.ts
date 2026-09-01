/**
 * Tests for messageCreate/antiSpam handler (4 niezależne reguły: rate/invites/mentions/repeat).
 */

/* ── mocks (must be declared before imports) ─────────────── */

const DEFAULT_RULE = {
  on: false,
  deleteMessage: true,
  mode: 'single',
  action: 'mute',
  steps: ['warn'],
  muteDuration: '5',
  reset: '24',
  threshold: 5,
  windowSeconds: 3,
  allowOwnServerInvites: true,
};

jest.mock('../../../src/services/antiSpamService', () => ({
  getConfig: jest.fn().mockResolvedValue({
    enabled: false,
    ignoredChannels: [],
    ignoredRoles: [],
    rate: { on: false, deleteMessage: true, mode: 'single', action: 'mute', steps: ['warn'], muteDuration: '5', reset: '24', threshold: 5, windowSeconds: 3, allowOwnServerInvites: true },
    invites: { on: false, deleteMessage: true, mode: 'single', action: 'mute', steps: ['warn'], muteDuration: '5', reset: '24', threshold: 5, windowSeconds: 3, allowOwnServerInvites: true },
    mentions: { on: false, deleteMessage: true, mode: 'single', action: 'mute', steps: ['warn'], muteDuration: '5', reset: '24', threshold: 5, windowSeconds: 3, allowOwnServerInvites: true },
    repeat: { on: false, deleteMessage: true, mode: 'single', action: 'mute', steps: ['warn'], muteDuration: '5', reset: '24', threshold: 5, windowSeconds: 3, allowOwnServerInvites: true },
  }),
  trackMessage: jest.fn().mockReturnValue({ isSpam: false, messageCount: 1 }),
  trackFlood: jest.fn().mockReturnValue({ isFlood: false, duplicateCount: 1, channels: [] }),
  clearUserHistory: jest.fn(),
  clearFloodHistory: jest.fn(),
  startCleanup: jest.fn(),
  getNextPunishment: jest.fn().mockImplementation(async (_g: string, _u: string, _r: string, rule: any) => rule.action),
  recordIncident: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/services/warnService', () => ({
  addWarn: jest.fn().mockResolvedValue({ ok: true, data: { count: 1, shouldBan: false, punishment: null, nextPunishment: null } }),
  WARN_LIMIT: 4,
}));

// antiSpam.ts korzysta teraz z applyTimeoutSafely() (moderationHelpers.ts), która importuje
// pretty-ms (ESM-only) — bez mocka ts-jest nie potrafi tego zaimportować.
jest.mock('pretty-ms', () => ({
  __esModule: true,
  default: (ms: number) => `${ms}ms`,
}));

jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: jest.fn().mockResolvedValue(undefined),
  guildFooter: jest.fn().mockReturnValue({}),
  truncate: jest.fn((text: string, max = 1024) => (text.length <= max ? text : text.slice(0, max - 3) + '...')),
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { Collection, PermissionsBitField } from 'discord.js';
import { mockMessage, mockUser, mockGuildMember, mockClient, mockTextChannel, mockGuild } from '../../helpers/discordMocks';

import {
  getConfig,
  trackMessage,
  trackFlood,
  clearUserHistory,
  clearFloodHistory,
  getNextPunishment,
} from '../../../src/services/antiSpamService';
import { addWarn } from '../../../src/services/warnService';
import { sendLog } from '../../../src/utils/logHelpers';

let run: (message: any, client: any) => Promise<boolean | void>;

beforeAll(async () => {
  run = (await import('../../../src/events/messageCreate/antiSpam')).default;
});

/** Buduje pełny nested config Anti-Spam z override'ami per reguła. */
function buildConfig(opts: {
  enabled?: boolean;
  ignoredChannels?: string[];
  ignoredRoles?: string[];
  rate?: Partial<typeof DEFAULT_RULE>;
  invites?: Partial<typeof DEFAULT_RULE>;
  mentions?: Partial<typeof DEFAULT_RULE>;
  repeat?: Partial<typeof DEFAULT_RULE>;
} = {}) {
  return {
    enabled: opts.enabled ?? true,
    ignoredChannels: opts.ignoredChannels ?? [],
    ignoredRoles: opts.ignoredRoles ?? [],
    rate: { ...DEFAULT_RULE, ...opts.rate },
    invites: { ...DEFAULT_RULE, ...opts.invites },
    mentions: { ...DEFAULT_RULE, ...opts.mentions },
    repeat: { ...DEFAULT_RULE, ...opts.repeat },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getConfig as jest.Mock).mockResolvedValue(buildConfig({ enabled: false }));
  (trackMessage as jest.Mock).mockReturnValue({ isSpam: false, messageCount: 1 });
  (trackFlood as jest.Mock).mockReturnValue({ isFlood: false, duplicateCount: 1, channels: [] });
  (getNextPunishment as jest.Mock).mockImplementation(async (_g: string, _u: string, _r: string, rule: any) => rule.action);
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
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ ignoredChannels: ['ch-1'], rate: { on: true } }));

    const msg = mockMessage();
    msg.author.bot = false;
    msg.channelId = 'ch-1';
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(trackMessage).not.toHaveBeenCalled();
  });

  it('skips members with ignored roles', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ ignoredRoles: ['role-mod'], rate: { on: true } }));

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
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true } }));

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
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true } }));

    const member = mockGuildMember();
    member.permissions = new PermissionsBitField();

    const msg = mockMessage({ member });
    msg.author.bot = false;

    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(trackMessage).toHaveBeenCalled();
    expect(clearUserHistory).not.toHaveBeenCalled();
  });

  it('does not track when the rate rule is off', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: false } }));

    const member = mockGuildMember();
    member.permissions = new PermissionsBitField();
    const msg = mockMessage({ member });
    msg.author.bot = false;

    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(trackMessage).not.toHaveBeenCalled();
  });
});

/* ── Spam detected (reguła 'rate') ────────────────────────── */

describe('antiSpam handler — rate rule detection', () => {
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
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true, action: 'mute', muteDuration: '5' } }));
    (trackMessage as jest.Mock).mockReturnValue({ isSpam: true, messageCount: 6 });
  });

  it('returns true to short-circuit the handler chain', async () => {
    const { msg } = makeSpamMessage();
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
  });

  it('clears rate history after detection', async () => {
    const { msg } = makeSpamMessage();
    await run(msg, mockClient());
    expect(clearUserHistory).toHaveBeenCalledWith(msg.guild.id, msg.author.id);
  });

  it('deletes recent messages when deleteMessage=true', async () => {
    const { msg, channel } = makeSpamMessage();
    await run(msg, mockClient());
    expect(channel.messages.fetch).toHaveBeenCalledWith({ limit: 20 });
    expect(channel.bulkDelete).toHaveBeenCalled();
  });

  it('does not delete messages when deleteMessage=false', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true, deleteMessage: false } }));
    const { msg, channel } = makeSpamMessage();
    await run(msg, mockClient());
    expect(channel.bulkDelete).not.toHaveBeenCalled();
  });

  it('applies mute when action=mute', async () => {
    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());
    expect(member.timeout).toHaveBeenCalledWith(300_000, expect.any(String));
  });

  it('adds a warn when action=warn', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true, action: 'warn' } }));

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
  });

  it('applies the warn ladder consequences: bans when the warn hits the limit (shouldBan)', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true, action: 'warn' } }));
    (addWarn as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { count: 4, shouldBan: true, punishment: null, nextPunishment: null },
    });

    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());

    // Wcześniej ten branch tylko zapisywał wpis do bazy i nic więcej — auto-ban z drabinki /warn
    // był całkowicie ignorowany mimo osiągnięcia limitu.
    expect(member.ban).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining('Auto-ban') }));
  });

  it('applies the warn ladder consequences: times out when the warn level carries a mute duration', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true, action: 'warn' } }));
    (addWarn as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { count: 1, shouldBan: false, punishment: { duration: 900000, label: '15 minut' }, nextPunishment: null },
    });

    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());

    // Wcześniej ten branch nigdy nie wołał .timeout() — poziom kary z drabinki /warn (np. 15 minut
    // przy 1. ostrzeżeniu) był ignorowany, user dostawał tylko wpis w bazie i usunięcie wiadomości.
    expect(member.timeout).toHaveBeenCalledWith(900000, expect.stringContaining('Anti-Spam'));
  });

  it('kicks when action=kick', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true, action: 'kick' } }));

    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());
    expect(member.kick).toHaveBeenCalledWith(expect.stringContaining('Anti-Spam'));
  });

  it('bans when action=ban', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true, action: 'ban' } }));

    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());
    expect(member.ban).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining('Anti-Spam') }));
  });

  it('does nothing extra when action=none (besides deleting)', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ rate: { on: true, action: 'none' } }));

    const { msg, member } = makeSpamMessage();
    await run(msg, mockClient());
    expect(member.timeout).not.toHaveBeenCalled();
    expect(member.kick).not.toHaveBeenCalled();
    expect(member.ban).not.toHaveBeenCalled();
  });

  it('sends a log to the guild log channel', async () => {
    const { msg } = makeSpamMessage();
    const client = mockClient();
    await run(msg, client);
    expect(sendLog).toHaveBeenCalledWith(client, msg.guild.id, 'antiSpam', expect.objectContaining({ description: expect.any(String) }));
  });
});

/* ── Invite link blocking (reguła 'invites') ──────────────── */

describe('antiSpam handler — invite link blocking', () => {
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
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ invites: { on: true, action: 'mute', muteDuration: '5' } }));
  });

  it('blocks discord.gg invite to another server', async () => {
    const { msg } = makeInviteMessage('Join my server! https://discord.gg/abc123');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({ guild: { id: 'other-guild', name: 'Other Server' } });

    const result = await run(msg, client);
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
    expect(sendLog).toHaveBeenCalledWith(client, 'current-guild', 'antiSpam', expect.objectContaining({ title: '🛡️ Zablokowane zaproszenie' }));
  });

  it('blocks discord.com/invite link to another server', async () => {
    const { msg } = makeInviteMessage('Check this out https://discord.com/invite/xyz789');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({ guild: { id: 'other-guild', name: 'Other Server' } });

    const result = await run(msg, client);
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
  });

  it('allows invite to the same server when allowOwnServerInvites=true', async () => {
    const { msg } = makeInviteMessage('Share this: https://discord.gg/ourserver');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({ guild: { id: 'current-guild', name: 'Our Server' } });

    const result = await run(msg, client);
    expect(result).toBeUndefined();
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it('blocks invite to the same server when allowOwnServerInvites=false', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ invites: { on: true, allowOwnServerInvites: false } }));
    const { msg } = makeInviteMessage('Share this: https://discord.gg/ourserver');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({ guild: { id: 'current-guild', name: 'Our Server' } });

    const result = await run(msg, client);
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
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

  it('does not check invites when the rule is off', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ invites: { on: false } }));

    const { msg } = makeInviteMessage('https://discord.gg/abc123');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({ guild: { id: 'other-guild', name: 'Other Server' } });

    const result = await run(msg, client);
    expect(result).toBeUndefined();
    expect(client.fetchInvite).not.toHaveBeenCalled();
  });

  it('applies configured action on blocked invite', async () => {
    const { msg, member } = makeInviteMessage('https://discord.gg/abc123');

    const client = mockClient();
    client.fetchInvite = jest.fn().mockResolvedValue({ guild: { id: 'other-guild', name: 'Other Server' } });

    await run(msg, client);
    expect(member.timeout).toHaveBeenCalledWith(300_000, expect.any(String));
  });
});

/* ── Mass mention blocking (reguła 'mentions') ────────────── */

describe('antiSpam handler — mass mention blocking', () => {
  function makeMentionMessage(opts: { userMentions?: number; roleMentions?: number; everyone?: boolean } = {}) {
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

    const users = new Collection<string, any>();
    for (let i = 0; i < (opts.userMentions ?? 0); i++) users.set(`u${i}`, { id: `u${i}` });
    const roles = new Collection<string, any>();
    for (let i = 0; i < (opts.roleMentions ?? 0); i++) roles.set(`r${i}`, { id: `r${i}` });
    msg.mentions = { users, roles, everyone: opts.everyone ?? false };

    return { msg, member, channel, guild };
  }

  beforeEach(() => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ mentions: { on: true, action: 'mute', muteDuration: '5', threshold: 5 } }));
  });

  it('blocks @everyone mention', async () => {
    const { msg } = makeMentionMessage({ everyone: true });
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
    expect(sendLog).toHaveBeenCalledWith(expect.anything(), 'guild-mention', 'antiSpam', expect.objectContaining({ title: '🛡️ Zablokowane wzmianki' }));
  });

  it('blocks when user mentions exceed threshold', async () => {
    const { msg } = makeMentionMessage({ userMentions: 6 });
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
  });

  it('blocks when role mentions exceed threshold', async () => {
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

  it('does not check when the rule is off', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ mentions: { on: false } }));
    const { msg } = makeMentionMessage({ everyone: true, userMentions: 10 });
    const result = await run(msg, mockClient());
    expect(result).toBeUndefined();
    expect(msg.delete).not.toHaveBeenCalled();
  });

  it('applies configured action on blocked mention', async () => {
    const { msg, member } = makeMentionMessage({ userMentions: 10 });
    await run(msg, mockClient());
    expect(member.timeout).toHaveBeenCalledWith(300_000, expect.any(String));
  });

  it('respects a custom threshold', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ mentions: { on: true, threshold: 2 } }));
    const { msg } = makeMentionMessage({ userMentions: 3 });
    const result = await run(msg, mockClient());
    expect(result).toBe(true);
  });
});

/* ── Repeat detection (reguła 'repeat') ───────────────────── */

describe('antiSpam handler — repeat rule detection', () => {
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
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ repeat: { on: true, action: 'mute', muteDuration: '5', threshold: 3, windowSeconds: 30 } }));
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: false, duplicateCount: 1, channels: [] });
  });

  it('blocks message when a repeat is detected', async () => {
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 3, channels: ['ch-1', 'ch-2', 'ch-3'] });

    const { msg, member } = makeFloodMessage();
    const result = await run(msg, mockClient());

    expect(result).toBe(true);
    expect(clearFloodHistory).toHaveBeenCalled();
    expect(member.timeout).toHaveBeenCalledWith(300_000, expect.any(String));
    expect(sendLog).toHaveBeenCalled();
  });

  it('does not block when the repeat threshold is not reached', async () => {
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: false, duplicateCount: 2, channels: ['ch-1', 'ch-2'] });

    const { msg } = makeFloodMessage();
    const result = await run(msg, mockClient());

    expect(result).toBeUndefined();
    expect(clearFloodHistory).not.toHaveBeenCalled();
  });

  it('skips the check when the rule is off', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ repeat: { on: false } }));
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 5, channels: [] });

    const { msg } = makeFloodMessage();
    await run(msg, mockClient());

    expect(clearFloodHistory).not.toHaveBeenCalled();
  });

  it('skips the check for empty messages', async () => {
    const { msg } = makeFloodMessage('');
    await run(msg, mockClient());
    expect(trackFlood).not.toHaveBeenCalled();
  });

  it('deletes the message on repeat when deleteMessage=true', async () => {
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 3, channels: ['ch-1'] });

    const { msg } = makeFloodMessage();
    msg.deletable = true;
    const result = await run(msg, mockClient());

    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalled();
  });

  it('applies ban action on repeat', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ repeat: { on: true, action: 'ban' } }));
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 3, channels: ['ch-1', 'ch-2', 'ch-3'] });

    const { msg, member } = makeFloodMessage();
    await run(msg, mockClient());

    expect(member.ban).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.any(String), deleteMessageSeconds: 60 }));
  });

  it('applies kick action on repeat', async () => {
    (getConfig as jest.Mock).mockResolvedValue(buildConfig({ repeat: { on: true, action: 'kick' } }));
    (trackFlood as jest.Mock).mockReturnValue({ isFlood: true, duplicateCount: 3, channels: ['ch-1', 'ch-2', 'ch-3'] });

    const { msg, member } = makeFloodMessage();
    await run(msg, mockClient());

    expect(member.kick).toHaveBeenCalledWith(expect.any(String));
  });
});
