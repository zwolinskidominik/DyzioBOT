/**
 * Branch-coverage tests batch 1 — targeting small log/event files
 * that have low branch coverage due to moderator ternaries, guard clauses, etc.
 *
 * Files covered:
 *  - logRoleCreate          (50% branches)
 *  - logRoleDelete          (50% branches)
 *  - logChannelDelete       (40% branches)
 *  - logThreadCreate        (60% branches)
 *  - logThreadDelete        (50% branches)
 *  - logThreadUpdate        (47% branches)
 *  - logInviteCreate        (various branches)
 *  - logMemberRemove        (70% branches)
 *  - logMemberJoin           (simple, error branch)
 *  - boostDetection         (77% branches)
 *  - reactionRoleRemove     (66% branches)
 *  - deleteStatsChannel     (75% branches)
 *  - cooldownHelpers        (66% branches)
 *  - guild.ts               (57% branches)
 */

/* ── mocks ──────────────────────────────────────────────────── */

jest.mock('../../../src/utils/logHelpers', () => ({ sendLog: jest.fn() }));
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: jest.fn(),
  getAuditLogEntry: jest.fn(),
  getReason: jest.fn(),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/models/ReactionRole', () => ({
  ReactionRoleModel: { findOne: jest.fn() },
}));
jest.mock('../../../src/models/ChannelStats', () => ({
  ChannelStatsModel: { findOne: jest.fn() },
}));
jest.mock('../../../src/config/guild', () => ({
  getGuildConfig: jest.fn(),
  __getGuildAssetsUnsafeForTests: jest.fn(),
}));
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: { boost: { thanks: '<:thanks:1>' } },
  }),
}));

import { sendLog } from '../../../src/utils/logHelpers';
import { getModerator, getAuditLogEntry, getReason } from '../../../src/utils/auditLogHelpers';
import { ReactionRoleModel } from '../../../src/models/ReactionRole';
import { ChannelStatsModel } from '../../../src/models/ChannelStats';
import { ChannelType } from 'discord.js';

const sendLogMock = sendLog as jest.Mock;
const getModeratorMock = getModerator as jest.Mock;
const getAuditLogEntryMock = getAuditLogEntry as jest.Mock;
const getReasonMock = getReason as jest.Mock;

/* ── helpers ────────────────────────────────────────────────── */

function makeGuild(overrides: Record<string, any> = {}) {
  return { id: 'g1', channels: { cache: new Map() }, members: { fetch: jest.fn() }, ...overrides };
}
function makeRole(overrides: Record<string, any> = {}) {
  return { id: 'r1', name: 'TestRole', hexColor: '#ff0000', guild: makeGuild(), ...overrides };
}
function makeClient() {
  return { user: { id: 'bot1' } };
}

/* ================================================================
   logRoleCreate
   ================================================================ */
describe('logRoleCreate', () => {
  let run: (role: any, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/roleCreate/logRoleCreate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('sends log WITH moderator mention', async () => {
    getModeratorMock.mockResolvedValue({ id: 'mod1' });
    await run(makeRole(), makeClient());
    expect(sendLogMock).toHaveBeenCalledTimes(1);
    const desc = sendLogMock.mock.calls[0][3].description;
    expect(desc).toContain('mod1');
  });

  it('sends log WITHOUT moderator mention', async () => {
    getModeratorMock.mockResolvedValue(null);
    await run(makeRole(), makeClient());
    const desc = sendLogMock.mock.calls[0][3].description;
    expect(desc).not.toContain('mod1');
  });

  it('catches error and logs', async () => {
    getModeratorMock.mockRejectedValue(new Error('boom'));
    await expect(run(makeRole(), makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   logRoleDelete
   ================================================================ */
describe('logRoleDelete', () => {
  let run: (role: any, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/roleDelete/logRoleDelete')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('sends log WITH moderator', async () => {
    getModeratorMock.mockResolvedValue({ id: 'mod2' });
    await run(makeRole(), makeClient());
    expect(sendLogMock.mock.calls[0][3].description).toContain('mod2');
  });

  it('sends log WITHOUT moderator', async () => {
    getModeratorMock.mockResolvedValue(null);
    await run(makeRole(), makeClient());
    expect(sendLogMock.mock.calls[0][3].description).not.toContain('przez');
  });

  it('catches error', async () => {
    getModeratorMock.mockRejectedValue(new Error('err'));
    await expect(run(makeRole(), makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   logChannelDelete
   ================================================================ */
describe('logChannelDelete', () => {
  let run: (channel: any, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/channelDelete/logChannelDelete')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns early for DM channel (no guild property)', async () => {
    await run({ id: 'ch1' }, makeClient());
    expect(sendLogMock).not.toHaveBeenCalled();
  });

  it('sends log WITH moderator, known channel type', async () => {
    getModeratorMock.mockResolvedValue({ id: 'mod3' });
    const ch = { id: 'ch2', name: 'general', type: ChannelType.GuildText, guild: makeGuild() };
    await run(ch, makeClient());
    expect(sendLogMock).toHaveBeenCalledTimes(1);
    const args = sendLogMock.mock.calls[0][3];
    expect(args.description).toContain('mod3');
    expect(args.fields[0].value).toBe('Tekstowy');
  });

  it('sends log WITHOUT moderator, unknown channel type', async () => {
    getModeratorMock.mockResolvedValue(null);
    const ch = { id: 'ch3', name: 'test', type: 999 as any, guild: makeGuild() };
    await run(ch, makeClient());
    const args = sendLogMock.mock.calls[0][3];
    expect(args.description).not.toContain('przez');
    expect(args.fields[0].value).toBe('Nieznany');
  });

  it('handles GuildVoice type', async () => {
    getModeratorMock.mockResolvedValue(null);
    const ch = { id: 'ch4', name: 'vc', type: ChannelType.GuildVoice, guild: makeGuild() };
    await run(ch, makeClient());
    expect(sendLogMock.mock.calls[0][3].fields[0].value).toContain('osowy');
  });

  it('handles GuildCategory type', async () => {
    getModeratorMock.mockResolvedValue(null);
    const ch = { id: 'ch5', name: 'cat', type: ChannelType.GuildCategory, guild: makeGuild() };
    await run(ch, makeClient());
    expect(sendLogMock.mock.calls[0][3].fields[0].value).toBe('Kategoria');
  });

  it('handles GuildForum type', async () => {
    getModeratorMock.mockResolvedValue(null);
    const ch = { id: 'ch6', name: 'forum', type: ChannelType.GuildForum, guild: makeGuild() };
    await run(ch, makeClient());
    expect(sendLogMock.mock.calls[0][3].fields[0].value).toBe('Forum');
  });

  it('catches error', async () => {
    getModeratorMock.mockRejectedValue(new Error('err'));
    const ch = { id: 'ch7', name: 'x', type: ChannelType.GuildText, guild: makeGuild() };
    await expect(run(ch, makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   logThreadCreate
   ================================================================ */
describe('logThreadCreate', () => {
  let run: (thread: any, newlyCreated: boolean, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/threadCreate/logThreadCreate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns early if thread.guild is undefined', async () => {
    await run({ guild: null }, true, makeClient());
    expect(sendLogMock).not.toHaveBeenCalled();
  });

  it('sends log WITH moderator and WITH parentId', async () => {
    getModeratorMock.mockResolvedValue({ id: 'mod4' });
    const thread = { id: 't1', name: 'Thread', parentId: 'p1', guild: makeGuild() };
    await run(thread, true, makeClient());
    expect(sendLogMock).toHaveBeenCalledTimes(1);
    expect(sendLogMock.mock.calls[0][3].description).toContain('mod4');
    expect(sendLogMock.mock.calls[0][4]).toEqual({ channelId: 'p1' });
  });

  it('sends log WITHOUT moderator and WITHOUT parentId', async () => {
    getModeratorMock.mockResolvedValue(null);
    const thread = { id: 't2', name: 'Thread2', parentId: null, guild: makeGuild() };
    await run(thread, false, makeClient());
    expect(sendLogMock.mock.calls[0][3].description).not.toContain('przez');
    expect(sendLogMock.mock.calls[0][4]).toBeUndefined();
  });

  it('catches error', async () => {
    getModeratorMock.mockRejectedValue(new Error('err'));
    const thread = { id: 't3', name: 'T', parentId: 'p', guild: makeGuild() };
    await expect(run(thread, true, makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   logThreadDelete
   ================================================================ */
describe('logThreadDelete', () => {
  let run: (thread: any, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/threadDelete/logThreadDelete')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('sends log WITH moderator, WITH parentId', async () => {
    getModeratorMock.mockResolvedValue({ id: 'modDel' });
    const t = { id: 'td1', name: 'Del', parentId: 'p1', guild: makeGuild() };
    await run(t, makeClient());
    expect(sendLogMock.mock.calls[0][3].description).toContain('modDel');
    expect(sendLogMock.mock.calls[0][4]).toEqual({ channelId: 'p1' });
  });

  it('sends log WITHOUT moderator, WITHOUT parentId', async () => {
    getModeratorMock.mockResolvedValue(null);
    const t = { id: 'td2', name: 'Del2', parentId: null, guild: makeGuild() };
    await run(t, makeClient());
    expect(sendLogMock.mock.calls[0][3].description).not.toContain('przez');
    expect(sendLogMock.mock.calls[0][4]).toBeUndefined();
  });

  it('catches error', async () => {
    getModeratorMock.mockRejectedValue(new Error('e'));
    const t = { id: 'td3', name: 'D', parentId: 'p', guild: makeGuild() };
    await expect(run(t, makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   logThreadUpdate — name, archived, locked branches
   ================================================================ */
describe('logThreadUpdate', () => {
  let run: (oldThread: any, newThread: any, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/threadUpdate/logThreadUpdate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  const base = () => ({
    id: 'tu1', name: 'Original', archived: false, locked: false, parentId: 'p1', guild: makeGuild(),
  });

  it('logs name change WITH moderator', async () => {
    getModeratorMock.mockResolvedValue({ id: 'modU' });
    await run(base(), { ...base(), name: 'NewName' }, makeClient());
    expect(sendLogMock).toHaveBeenCalledTimes(1);
    expect(sendLogMock.mock.calls[0][3].description).toContain('modU');
  });

  it('logs name change WITHOUT moderator', async () => {
    getModeratorMock.mockResolvedValue(null);
    await run(base(), { ...base(), name: 'NewName' }, makeClient());
    expect(sendLogMock.mock.calls[0][3].description).not.toContain('przez');
  });

  it('logs archived=true WITH moderator', async () => {
    getModeratorMock.mockResolvedValue({ id: 'modA' });
    await run(base(), { ...base(), archived: true }, makeClient());
    expect(sendLogMock).toHaveBeenCalledTimes(1);
    expect(sendLogMock.mock.calls[0][3].description).toContain('zarchiwizowany');
    expect(sendLogMock.mock.calls[0][3].description).toContain('modA');
  });

  it('logs archived=false (unarchived) WITHOUT moderator', async () => {
    getModeratorMock.mockResolvedValue(null);
    const old = { ...base(), archived: true };
    const nw = { ...base(), archived: false };
    await run(old, nw, makeClient());
    expect(sendLogMock.mock.calls[0][3].description).toContain('odarchiwizowany');
  });

  it('logs locked=true WITH moderator', async () => {
    getModeratorMock.mockResolvedValue({ id: 'modL' });
    await run(base(), { ...base(), locked: true }, makeClient());
    expect(sendLogMock.mock.calls[0][3].description).toContain('zamkni');
  });

  it('logs locked=false (unlocked) WITHOUT moderator', async () => {
    getModeratorMock.mockResolvedValue(null);
    const old = { ...base(), locked: true };
    const nw = { ...base(), locked: false };
    await run(old, nw, makeClient());
    expect(sendLogMock.mock.calls[0][3].description).toContain('otwarty');
  });

  it('logs all changes at once', async () => {
    getModeratorMock.mockResolvedValue({ id: 'modAll' });
    const old = base();
    const nw = { ...base(), name: 'Changed', archived: true, locked: true };
    await run(old, nw, makeClient());
    expect(sendLogMock).toHaveBeenCalledTimes(3);
  });

  it('no log when nothing changed', async () => {
    getModeratorMock.mockResolvedValue(null);
    await run(base(), base(), makeClient());
    expect(sendLogMock).not.toHaveBeenCalled();
  });

  it('uses undefined ctx when no parentId', async () => {
    getModeratorMock.mockResolvedValue(null);
    const old = { ...base(), parentId: null };
    const nw = { ...base(), parentId: null, name: 'X' };
    await run(old, nw, makeClient());
    expect(sendLogMock.mock.calls[0][4]).toBeUndefined();
  });

  it('catches error', async () => {
    getModeratorMock.mockRejectedValue(new Error('err'));
    await expect(run(base(), { ...base(), name: 'X' }, makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   logInviteCreate — inviter, expiresTimestamp, channel, maxUses branches
   ================================================================ */
describe('logInviteCreate', () => {
  let run: (invite: any, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/inviteCreate/logInviteCreate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns early if no guild', async () => {
    await run({ guild: null }, makeClient());
    expect(sendLogMock).not.toHaveBeenCalled();
  });

  it('sends log WITH inviter, expiry, channel, maxUses', async () => {
    const invite = {
      guild: { id: 'g1' },
      inviter: { id: 'inv1' },
      code: 'ABC',
      channel: { id: 'ch1' },
      channelId: 'ch1',
      expiresTimestamp: Date.now() + 60000,
      maxUses: 10,
    };
    await run(invite, makeClient());
    const args = sendLogMock.mock.calls[0][3];
    expect(args.description).toContain('inv1');
    expect(args.fields[2].value).not.toBe('Nigdy');
    expect(args.fields[3].value).toBe('10');
  });

  it('sends log WITHOUT inviter, no expiry, no channel, unlimited uses', async () => {
    const invite = {
      guild: { id: 'g1' },
      inviter: null,
      code: 'DEF',
      channel: null,
      channelId: null,
      expiresTimestamp: null,
      maxUses: 0,
    };
    await run(invite, makeClient());
    const args = sendLogMock.mock.calls[0][3];
    expect(args.description).not.toContain('przez');
    expect(args.fields[1].value).toBe('*Nieznany*');
    expect(args.fields[2].value).toBe('Nigdy');
    expect(args.fields[3].value).toBe('Nielimitowane');
  });

  it('catches error', async () => {
    sendLogMock.mockRejectedValue(new Error('e'));
    const invite = { guild: { id: 'g1' }, inviter: null, code: 'X', channel: null, channelId: null, expiresTimestamp: null, maxUses: 0 };
    await expect(run(invite, makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   logMemberRemove — kick vs leave, moderator, joinedAt
   ================================================================ */
describe('logMemberRemove', () => {
  let run: (member: any, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberRemove/logMemberRemove')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  const makeMember = (overrides: Record<string, any> = {}) => ({
    id: 'u1',
    guild: makeGuild(),
    user: { tag: 'user#0001', displayAvatarURL: jest.fn().mockReturnValue('url') },
    joinedAt: new Date(),
    joinedTimestamp: Date.now() - 10000,
    ...overrides,
  });

  it('logs KICK with moderator and reason', async () => {
    getAuditLogEntryMock.mockResolvedValue({ executor: { id: 'mod1' } });
    getModeratorMock.mockResolvedValue({ id: 'mod1', username: 'ModUser', displayAvatarURL: jest.fn().mockReturnValue('modUrl') });
    getReasonMock.mockResolvedValue('Bad behavior');
    await run(makeMember(), makeClient());
    expect(sendLogMock).toHaveBeenCalledTimes(1);
    expect(sendLogMock.mock.calls[0][2]).toBe('memberKick');
    const args = sendLogMock.mock.calls[0][3];
    expect(args.fields[0].value).toContain('mod1');
    expect(args.fields[1].value).toBe('Bad behavior');
  });

  it('logs KICK without moderator and without reason', async () => {
    getAuditLogEntryMock.mockResolvedValue({ executor: null });
    getModeratorMock.mockResolvedValue(null);
    getReasonMock.mockResolvedValue(null);
    await run(makeMember(), makeClient());
    expect(sendLogMock.mock.calls[0][2]).toBe('memberKick');
    const args = sendLogMock.mock.calls[0][3];
    expect(args.fields[0].value).toBe('Nieznany');
    expect(args.fields[1].value).toBe('Brak powodu');
    expect(args.footer).toBe('Nieznany moderator');
  });

  it('logs LEAVE with joinedAt', async () => {
    getAuditLogEntryMock.mockResolvedValue(null);
    const m = makeMember({ joinedAt: new Date(), joinedTimestamp: Date.now() - 100000 });
    await run(m, makeClient());
    expect(sendLogMock.mock.calls[0][2]).toBe('memberLeave');
    const fields = sendLogMock.mock.calls[0][3].fields;
    expect(fields[0].value).toContain('<t:');
  });

  it('logs LEAVE without joinedAt', async () => {
    getAuditLogEntryMock.mockResolvedValue(null);
    const m = makeMember({ joinedAt: null, joinedTimestamp: null });
    await run(m, makeClient());
    const fields = sendLogMock.mock.calls[0][3].fields;
    expect(fields[0].value).toBe('Nieznany');
  });

  it('catches error', async () => {
    getAuditLogEntryMock.mockRejectedValue(new Error('err'));
    await expect(run(makeMember(), makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   logMemberJoin — straightforward, just error branch
   ================================================================ */
describe('logMemberJoin', () => {
  let run: (member: any, client: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberAdd/logMemberJoin')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('sends log with member data', async () => {
    const m = {
      id: 'u2', guild: { id: 'g1', memberCount: 42 },
      user: { tag: 'User#1', displayAvatarURL: jest.fn().mockReturnValue('url'), createdTimestamp: Date.now() - 86400000 },
    };
    await run(m, makeClient());
    expect(sendLogMock).toHaveBeenCalledTimes(1);
    expect(sendLogMock.mock.calls[0][2]).toBe('memberJoin');
  });

  it('catches error', async () => {
    sendLogMock.mockRejectedValue(new Error('err'));
    const m = {
      id: 'u3', guild: { id: 'g1', memberCount: 1 },
      user: { tag: 'U#1', displayAvatarURL: jest.fn().mockReturnValue(''), createdTimestamp: 0 },
    };
    await expect(run(m, makeClient())).resolves.toBeUndefined();
  });
});

/* ================================================================
   boostDetection — !oldStatus && newStatus, oldStatus && !newStatus, channel found/not found
   ================================================================ */
describe('boostDetection', () => {
  let run: (oldMember: any, newMember: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberUpdate/boostDetection')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  const { getGuildConfig } = require('../../../src/config/guild');
  const { getBotConfig } = require('../../../src/config/bot');

  it('sends boost message when new boost detected and channel exists', async () => {
    (getGuildConfig as jest.Mock).mockReturnValue({
      channels: { boostNotification: 'boostCh' },
    });
    (getBotConfig as jest.Mock).mockReturnValue({
      emojis: { boost: { thanks: '<:thx:1>' } },
    });

    const sendFn = jest.fn();
    const guild = {
      id: 'g1',
      channels: { cache: new Map([['boostCh', { send: sendFn }]]) },
    };
    const oldM = { premiumSince: null, guild, client: { user: { id: 'bot1' } } };
    const newM = { premiumSince: new Date(), guild, user: { id: 'u1' }, client: { user: { id: 'bot1' } } };
    await run(oldM, newM);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(sendFn.mock.calls[0][0]).toContain('u1');
  });

  it('does nothing when boost detected but channel not found', async () => {
    (getGuildConfig as jest.Mock).mockReturnValue({
      channels: { boostNotification: 'missing' },
    });
    const guild = {
      id: 'g1',
      channels: { cache: new Map() },
    };
    const oldM = { premiumSince: null, guild, client: { user: { id: 'bot1' } } };
    const newM = { premiumSince: new Date(), guild, user: { id: 'u1' }, client: { user: { id: 'bot1' } } };
    await run(oldM, newM);
    // no error, no send
  });

  it('does nothing when boost detected but channel has no send', async () => {
    (getGuildConfig as jest.Mock).mockReturnValue({
      channels: { boostNotification: 'ch1' },
    });
    const guild = {
      id: 'g1',
      channels: { cache: new Map([['ch1', { name: 'no-send' }]]) },
    };
    const oldM = { premiumSince: null, guild, client: { user: { id: 'bot1' } } };
    const newM = { premiumSince: new Date(), guild, user: { id: 'u1' }, client: { user: { id: 'bot1' } } };
    await run(oldM, newM);
  });

  it('handles un-boost (oldStatus && !newStatus)', async () => {
    (getGuildConfig as jest.Mock).mockReturnValue({
      channels: { boostNotification: 'ch1' },
    });
    const guild = { id: 'g1', channels: { cache: new Map() } };
    const oldM = { premiumSince: new Date(), guild, client: { user: { id: 'bot1' } } };
    const newM = { premiumSince: null, guild, user: { id: 'u1' }, client: { user: { id: 'bot1' } } };
    await run(oldM, newM);
    // no crash, just covers oldStatus && !newStatus branch
  });

  it('does nothing when both old and new have boost', async () => {
    (getGuildConfig as jest.Mock).mockReturnValue({
      channels: { boostNotification: 'ch1' },
    });
    const guild = { id: 'g1', channels: { cache: new Map() } };
    const oldM = { premiumSince: new Date(), guild, client: { user: { id: 'bot1' } } };
    const newM = { premiumSince: new Date(), guild, user: { id: 'u1' }, client: { user: { id: 'bot1' } } };
    await run(oldM, newM);
  });
});

/* ================================================================
   reactionRoleRemove — user.bot, partials, no guild, no data, no mapping, no member, no role, doesn't have role
   ================================================================ */
describe('reactionRoleRemove', () => {
  let run: (reaction: any, user: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/messageReactionRemove/reactionRoleRemove')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns early for bot user', async () => {
    await run({}, { bot: true });
    expect((ReactionRoleModel.findOne as jest.Mock)).not.toHaveBeenCalled();
  });

  it('fetches partial reaction and user', async () => {
    const reactionFetch = jest.fn().mockResolvedValue(undefined);
    const userFetch = jest.fn().mockResolvedValue(undefined);
    const reaction = {
      partial: true,
      fetch: reactionFetch,
      message: { guild: null },
      emoji: { toString: () => '🎉' },
    };
    const user = { bot: false, partial: true, fetch: userFetch };
    await run(reaction, user);
    expect(reactionFetch).toHaveBeenCalled();
    expect(userFetch).toHaveBeenCalled();
  });

  it('returns early if no guild', async () => {
    const reaction = { partial: false, message: { guild: null }, emoji: { toString: () => '🎉' } };
    await run(reaction, { bot: false, partial: false });
    expect((ReactionRoleModel.findOne as jest.Mock)).not.toHaveBeenCalled();
  });

  it('returns early if no reaction role data', async () => {
    (ReactionRoleModel.findOne as jest.Mock).mockResolvedValue(null);
    const reaction = {
      partial: false,
      message: { guild: { id: 'g1', members: { fetch: jest.fn() }, roles: { cache: new Map() } }, id: 'm1' },
      emoji: { toString: () => '🎉' },
    };
    await run(reaction, { bot: false, partial: false, id: 'u1' });
    expect((ReactionRoleModel.findOne as jest.Mock)).toHaveBeenCalled();
  });

  it('returns early if no matching emoji mapping', async () => {
    (ReactionRoleModel.findOne as jest.Mock).mockResolvedValue({
      reactions: [{ emoji: '🔥', roleId: 'r1' }],
    });
    const reaction = {
      partial: false,
      message: { guild: { id: 'g1', members: { fetch: jest.fn() }, roles: { cache: new Map() } }, id: 'm1' },
      emoji: { toString: () => '🎉' },
    };
    await run(reaction, { bot: false, partial: false, id: 'u1' });
  });

  it('returns early if member not found', async () => {
    (ReactionRoleModel.findOne as jest.Mock).mockResolvedValue({
      reactions: [{ emoji: '🎉', roleId: 'r1' }],
    });
    const guild = {
      id: 'g1',
      members: { fetch: jest.fn().mockResolvedValue(null) },
      roles: { cache: new Map([['r1', { id: 'r1' }]]) },
    };
    const reaction = {
      partial: false,
      message: { guild, id: 'm1' },
      emoji: { toString: () => '🎉' },
    };
    await run(reaction, { bot: false, partial: false, id: 'u1' });
  });

  it('returns early if role not found', async () => {
    (ReactionRoleModel.findOne as jest.Mock).mockResolvedValue({
      reactions: [{ emoji: '🎉', roleId: 'r1' }],
    });
    const member = { roles: { cache: new Map(), remove: jest.fn() } };
    const guild = {
      id: 'g1',
      members: { fetch: jest.fn().mockResolvedValue(member) },
      roles: { cache: new Map() },
    };
    const reaction = {
      partial: false,
      message: { guild, id: 'm1' },
      emoji: { toString: () => '🎉' },
    };
    await run(reaction, { bot: false, partial: false, id: 'u1' });
  });

  it('returns early if member does not have the role', async () => {
    (ReactionRoleModel.findOne as jest.Mock).mockResolvedValue({
      reactions: [{ emoji: '🎉', roleId: 'r1' }],
    });
    const member = {
      roles: { cache: new Map(), remove: jest.fn() },
    };
    (member.roles.cache as Map<string, any>).set = jest.fn();
    const guild = {
      id: 'g1',
      members: { fetch: jest.fn().mockResolvedValue(member) },
      roles: { cache: new Map([['r1', { id: 'r1' }]]) },
    };
    const reaction = {
      partial: false,
      message: { guild, id: 'm1' },
      emoji: { toString: () => '🎉' },
    };
    await run(reaction, { bot: false, partial: false, id: 'u1' });
    expect(member.roles.remove).not.toHaveBeenCalled();
  });

  it('removes role when member has the role', async () => {
    (ReactionRoleModel.findOne as jest.Mock).mockResolvedValue({
      reactions: [{ emoji: '🎉', roleId: 'r1' }],
    });
    const memberRolesCache = new Map([['r1', { id: 'r1' }]]);
    const member = {
      roles: { cache: memberRolesCache, remove: jest.fn() },
    };
    const guild = {
      id: 'g1',
      members: { fetch: jest.fn().mockResolvedValue(member) },
      roles: { cache: new Map([['r1', { id: 'r1' }]]) },
    };
    const reaction = {
      partial: false,
      message: { guild, id: 'm1' },
      emoji: { toString: () => '🎉' },
    };
    await run(reaction, { bot: false, partial: false, id: 'u1' });
    expect(member.roles.remove).toHaveBeenCalled();
  });

  it('catches error and logs', async () => {
    (ReactionRoleModel.findOne as jest.Mock).mockRejectedValue(new Error('db err'));
    const reaction = {
      partial: false,
      message: { guild: { id: 'g1' }, id: 'm1' },
      emoji: { toString: () => '🎉' },
    };
    await expect(run(reaction, { bot: false, partial: false, id: 'u1' })).resolves.toBeUndefined();
  });
});

/* ================================================================
   deleteStatsChannel — DM, wrong type, matching/not matching channels
   ================================================================ */
describe('deleteStatsChannel', () => {
  let run: (channel: any) => Promise<void>;
  beforeAll(async () => {
    run = (await import('../../../src/events/channelDelete/deleteStatsChannel')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns early for DM channel (no guild)', async () => {
    await run({ id: 'ch1' });
    expect((ChannelStatsModel.findOne as jest.Mock)).not.toHaveBeenCalled();
  });

  it('returns early for non-voice/non-text channel', async () => {
    const ch = { id: 'ch1', type: ChannelType.GuildCategory, guild: { id: 'g1' } };
    await run(ch);
    expect((ChannelStatsModel.findOne as jest.Mock)).not.toHaveBeenCalled();
  });

  it('returns early when no channelStats found', async () => {
    (ChannelStatsModel.findOne as jest.Mock).mockResolvedValue(null);
    const ch = { id: 'ch1', type: ChannelType.GuildVoice, guild: { id: 'g1' } };
    await run(ch);
  });

  it('clears matching stats channel (people)', async () => {
    const saveFn = jest.fn();
    const stats = {
      channels: {
        lastJoined: { channelId: 'other' },
        users: { channelId: 'ch1' },
        bots: { channelId: 'other2' },
        bans: { channelId: 'other3' },
      },
      save: saveFn,
    };
    (ChannelStatsModel.findOne as jest.Mock).mockResolvedValue(stats);
    const ch = { id: 'ch1', type: ChannelType.GuildText, guild: { id: 'g1' } };
    await run(ch);
    expect(stats.channels.users.channelId).toBeUndefined();
    expect(saveFn).toHaveBeenCalled();
  });

  it('clears matching stats channel (newest/lastJoined)', async () => {
    const saveFn = jest.fn();
    const stats = {
      channels: {
        lastJoined: { channelId: 'ch2' },
        users: { channelId: 'other' },
        bots: { channelId: 'other' },
        bans: { channelId: 'other' },
      },
      save: saveFn,
    };
    (ChannelStatsModel.findOne as jest.Mock).mockResolvedValue(stats);
    const ch = { id: 'ch2', type: ChannelType.GuildVoice, guild: { id: 'g1' } };
    await run(ch);
    expect(stats.channels.lastJoined.channelId).toBeUndefined();
    expect(saveFn).toHaveBeenCalled();
  });

  it('catches error', async () => {
    (ChannelStatsModel.findOne as jest.Mock).mockRejectedValue(new Error('db'));
    const ch = { id: 'ch3', type: ChannelType.GuildText, guild: { id: 'g1' } };
    await expect(run(ch)).resolves.toBeUndefined();
  });
});

/* ================================================================
   cooldownHelpers — debounce + tryAcquireCooldown branches
   ================================================================ */
describe('cooldownHelpers', () => {
  let debounce: (key: string, fn: () => void, delay?: number) => void;
  let tryAcquireCooldown: (key: string, interval?: number) => boolean;

  beforeAll(async () => {
    const mod = await import('../../../src/utils/cooldownHelpers');
    debounce = mod.debounce;
    tryAcquireCooldown = mod.tryAcquireCooldown;
  });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounce replaces previous timer for same key', () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    debounce('key1', fn1, 100);
    debounce('key1', fn2, 100);
    jest.advanceTimersByTime(150);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('debounce fires after delay', () => {
    const fn = jest.fn();
    debounce('key2', fn, 50);
    jest.advanceTimersByTime(60);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('debounce cleans up even if fn throws', () => {
    const fn = jest.fn(() => { throw new Error('oops'); });
    debounce('key3', fn, 10);
    expect(() => jest.advanceTimersByTime(20)).toThrow('oops');
    expect(fn).toHaveBeenCalled();
    // key should be cleaned up - can debounce again
    const fn2 = jest.fn();
    debounce('key3', fn2, 10);
    jest.advanceTimersByTime(20);
    expect(fn2).toHaveBeenCalled();
  });

  it('tryAcquireCooldown returns true first time', () => {
    expect(tryAcquireCooldown('cd1', 1000)).toBe(true);
  });

  it('tryAcquireCooldown returns false within interval', () => {
    tryAcquireCooldown('cd2', 1000);
    expect(tryAcquireCooldown('cd2', 1000)).toBe(false);
  });

  it('tryAcquireCooldown returns true after interval passes', () => {
    tryAcquireCooldown('cd3', 50);
    jest.advanceTimersByTime(60);
    expect(tryAcquireCooldown('cd3', 50)).toBe(true);
  });
});

/* ================================================================
   guild.ts — getGuildConfig known/unknown guild, __getGuildAssetsUnsafeForTests
   ================================================================ */
describe('guild.ts config', () => {
  let getGuildConfig: (guildId: string) => any;
  let __getGuildAssetsUnsafeForTests: () => Record<string, any>;

  beforeAll(async () => {
    // Import the REAL module, not the mock
    jest.unmock('../../../src/config/guild');
    const mod = await import('../../../src/config/guild');
    getGuildConfig = mod.getGuildConfig;
    __getGuildAssetsUnsafeForTests = mod.__getGuildAssetsUnsafeForTests;
  });

  it('returns config for known guild (main server)', () => {
    const cfg = getGuildConfig('881293681783623680');
    expect(cfg.roles.owner).toBe('881295973782007868');
    expect(cfg.channels.boostNotification).toBe('1292423972859940966');
    expect(cfg.tournament.organizerUserIds.length).toBeGreaterThan(0);
  });

  it('returns config for known guild (test server)', () => {
    const cfg = getGuildConfig('1264582308003053570');
    expect(cfg.roles.owner).toBe('1264582308263100482');
  });

  it('returns defaults for unknown guild', () => {
    const cfg = getGuildConfig('unknown_guild_id_999');
    expect(cfg.roles.owner).toBe('');
    expect(cfg.channels.boostNotification).toBe('');
    expect(cfg.tournament.organizerUserIds).toEqual([]);
  });

  it('returns defaults with independent objects (no reference sharing)', () => {
    const cfg1 = getGuildConfig('unknown1');
    const cfg2 = getGuildConfig('unknown2');
    cfg1.roles.owner = 'modified';
    expect(cfg2.roles.owner).toBe('');
  });

  it('exposes guild assets for tests', () => {
    const assets = __getGuildAssetsUnsafeForTests();
    expect(assets).toBeDefined();
    expect(typeof assets).toBe('object');
  });
});
