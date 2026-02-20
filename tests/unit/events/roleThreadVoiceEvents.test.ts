/**
 * Tests for remaining events:
 * - inviteCreate/logInviteCreate
 * - roleCreate/logRoleCreate, roleDelete/logRoleDelete, roleUpdate/logRoleUpdate
 * - threadCreate/logThreadCreate, threadDelete/logThreadDelete, threadUpdate/logThreadUpdate
 * - voiceStateUpdate/logVoiceStateUpdate, voiceStateUpdate/tempChannel
 */

/* ── mocks ───────────────────────────────────────────────── */

jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    setTimestamp: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  }),
}));

jest.mock('../../../src/services/tempChannelService', () => ({
  getMonitoredChannels: jest.fn().mockResolvedValue({ ok: true, data: [] }),
  saveTempChannel: jest.fn().mockResolvedValue({ ok: true, data: { channelId: 'vc-new' } }),
  deleteTempChannel: jest.fn().mockResolvedValue({ ok: true }),
  transferOwnership: jest.fn().mockResolvedValue({ ok: true, data: { oldOwnerId: 'u1' } }),
  getTempChannel: jest.fn().mockResolvedValue({ ok: false }),
  setControlMessageId: jest.fn(),
}));

import { sendLog } from '../../../src/utils/logHelpers';
import { getModerator } from '../../../src/utils/auditLogHelpers';
import {
  mockClient,
  mockGuild,
  mockRole,
  mockVoiceState,
  mockVoiceChannel,
  mockGuildMember,
  mockUser,
} from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* ── inviteCreate / logInviteCreate ───────────────────────── */

describe('inviteCreate / logInviteCreate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/inviteCreate/logInviteCreate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with inviteCreate', async () => {
    const client = mockClient();
    const invite = {
      guild: mockGuild(),
      inviter: mockUser(),
      code: 'abc123',
      channelId: 'ch-1',
      channel: { id: 'ch-1' },
      expiresTimestamp: Date.now() + 86400000,
      maxUses: 10,
    };
    await run(invite, client);
    expect(sendLog).toHaveBeenCalledWith(client, invite.guild.id, 'inviteCreate', expect.any(Object), expect.any(Object));
  });

  it('handles invite without guild', async () => {
    const client = mockClient();
    const invite = { guild: null, inviter: null, code: 'xyz' };
    await run(invite, client);
    expect(sendLog).not.toHaveBeenCalled();
  });
});

/* ── roleCreate / logRoleCreate ───────────────────────────── */

describe('roleCreate / logRoleCreate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/roleCreate/logRoleCreate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with roleCreate', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const role = mockRole({ guild, hexColor: '#ff0000' });
    await run(role, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'roleCreate', expect.any(Object));
  });
});

/* ── roleDelete / logRoleDelete ───────────────────────────── */

describe('roleDelete / logRoleDelete', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/roleDelete/logRoleDelete')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with roleDelete', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const role = mockRole({ guild, hexColor: '#00ff00' });
    await run(role, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'roleDelete', expect.any(Object));
  });
});

/* ── roleUpdate / logRoleUpdate ───────────────────────────── */

describe('roleUpdate / logRoleUpdate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/roleUpdate/logRoleUpdate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('logs name change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldRole = mockRole({ guild, name: 'OldRole', color: 0, hexColor: '#000000', permissions: { bitfield: 0n }, hoist: false, mentionable: false });
    const newRole = mockRole({ guild, name: 'NewRole', color: 0, hexColor: '#000000', permissions: { bitfield: 0n }, hoist: false, mentionable: false });
    await run(oldRole, newRole, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'roleUpdate', expect.any(Object));
  });

  it('logs color change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldRole = mockRole({ guild, name: 'Same', color: 0xff0000, hexColor: '#ff0000', permissions: { bitfield: 0n }, hoist: false, mentionable: false });
    const newRole = mockRole({ guild, name: 'Same', color: 0x00ff00, hexColor: '#00ff00', permissions: { bitfield: 0n }, hoist: false, mentionable: false });
    await run(oldRole, newRole, client);
    expect(sendLog).toHaveBeenCalled();
  });

  it('logs permission change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldRole = mockRole({ guild, name: 'Same', color: 0, hexColor: '#000', permissions: { bitfield: 0n }, hoist: false, mentionable: false });
    const newRole = mockRole({ guild, name: 'Same', color: 0, hexColor: '#000', permissions: { bitfield: 1n }, hoist: false, mentionable: false });
    await run(oldRole, newRole, client);
    expect(sendLog).toHaveBeenCalled();
  });

  it('does nothing when unchanged', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const role = mockRole({ guild, name: 'Same', color: 0, hexColor: '#000', permissions: { bitfield: 0n }, hoist: false, mentionable: false });
    await run(role, role, client);
    expect(sendLog).not.toHaveBeenCalled();
  });
});

/* ── threadCreate / logThreadCreate ───────────────────────── */

describe('threadCreate / logThreadCreate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/threadCreate/logThreadCreate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with threadCreate', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const thread = { id: 'thread-1', name: 'Test Thread', guild, parentId: 'ch-1' };
    await run(thread, true, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'threadCreate', expect.any(Object), expect.any(Object));
  });

  it('handles thread without guild', async () => {
    const client = mockClient();
    const thread = { id: 'thread-1', name: 'Test', guild: undefined, parentId: 'ch-1' };
    await run(thread, true, client);
    expect(sendLog).not.toHaveBeenCalled();
  });
});

/* ── threadDelete / logThreadDelete ───────────────────────── */

describe('threadDelete / logThreadDelete', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/threadDelete/logThreadDelete')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with threadDelete', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const thread = { id: 'thread-1', name: 'Deleted Thread', guild, parentId: 'ch-1' };
    await run(thread, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'threadDelete', expect.any(Object), expect.any(Object));
  });
});

/* ── threadUpdate / logThreadUpdate ───────────────────────── */

describe('threadUpdate / logThreadUpdate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/threadUpdate/logThreadUpdate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('logs name change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldThread = { id: 't-1', name: 'Old', guild, parentId: 'ch-1', archived: false, locked: false };
    const newThread = { id: 't-1', name: 'New', guild, parentId: 'ch-1', archived: false, locked: false };
    await run(oldThread, newThread, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'threadUpdate', expect.any(Object), expect.any(Object));
  });

  it('logs archive state change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldThread = { id: 't-1', name: 'Same', guild, parentId: 'ch-1', archived: false, locked: false };
    const newThread = { id: 't-1', name: 'Same', guild, parentId: 'ch-1', archived: true, locked: false };
    await run(oldThread, newThread, client);
    expect(sendLog).toHaveBeenCalled();
  });

  it('logs locked state change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldThread = { id: 't-1', name: 'Same', guild, parentId: 'ch-1', archived: false, locked: false };
    const newThread = { id: 't-1', name: 'Same', guild, parentId: 'ch-1', archived: false, locked: true };
    await run(oldThread, newThread, client);
    expect(sendLog).toHaveBeenCalled();
  });

  it('does nothing when unchanged', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const thread = { id: 't-1', name: 'Same', guild, parentId: 'ch-1', archived: false, locked: false };
    await run(thread, thread, client);
    expect(sendLog).not.toHaveBeenCalled();
  });
});

/* ── voiceStateUpdate / logVoiceStateUpdate ───────────────── */

describe('voiceStateUpdate / logVoiceStateUpdate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/voiceStateUpdate/logVoiceStateUpdate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('logs voice join', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const member = mockGuildMember();

    const oldState = mockVoiceState({ channel: null, channelId: null, guild, member });
    const newState = mockVoiceState({ channel: mockVoiceChannel(), channelId: 'vc-1', guild, member });

    await run(oldState, newState, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'voiceJoin', expect.any(Object), expect.any(Object));
  });

  it('logs voice leave', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const member = mockGuildMember();

    const oldState = mockVoiceState({ channel: mockVoiceChannel(), channelId: 'vc-1', guild, member });
    const newState = mockVoiceState({ channel: null, channelId: null, guild, member });

    await run(oldState, newState, client);
    expect(sendLog).toHaveBeenCalled();
    const logType = (sendLog as jest.Mock).mock.calls[0][2];
    expect(['voiceLeave', 'voiceDisconnect']).toContain(logType);
  });

  it('logs voice move', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const member = mockGuildMember();

    const oldState = mockVoiceState({ channel: mockVoiceChannel({ id: 'vc-1' }), channelId: 'vc-1', guild, member });
    const newState = mockVoiceState({ channel: mockVoiceChannel({ id: 'vc-2' }), channelId: 'vc-2', guild, member });

    await run(oldState, newState, client);
    expect(sendLog).toHaveBeenCalled();
    const logType = (sendLog as jest.Mock).mock.calls[0][2];
    expect(['voiceMove', 'voiceMemberMove']).toContain(logType);
  });

  it('returns when no member', async () => {
    const client = mockClient();
    const oldState = mockVoiceState({ member: null });
    const newState = mockVoiceState({ member: null });
    oldState.member = null;
    newState.member = null;
    await run(oldState, newState, client);
    expect(sendLog).not.toHaveBeenCalled();
  });

  it('logs voice state changes (mute/deafen)', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const member = mockGuildMember();
    const vc = mockVoiceChannel({ id: 'vc-1' });

    const oldState = mockVoiceState({ channel: vc, channelId: 'vc-1', guild, member, selfMute: false });
    const newState = mockVoiceState({ channel: vc, channelId: 'vc-1', guild, member, selfMute: true });

    await run(oldState, newState, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'voiceStateChange', expect.any(Object), expect.any(Object));
  });
});

/* ── voiceStateUpdate / tempChannel ───────────────────────── */

describe('voiceStateUpdate / tempChannel', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/voiceStateUpdate/tempChannel')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when not joining monitored channel', async () => {
    const guild = mockGuild();
    const member = mockGuildMember();
    const oldState = mockVoiceState({ channel: null, channelId: null, guild, member });
    const newState = mockVoiceState({ channel: mockVoiceChannel(), channelId: 'vc-1', guild, member });
    await run(oldState, newState);
    // No temp channel created because vc-1 is not monitored
    const { saveTempChannel } = require('../../../src/services/tempChannelService');
    expect(saveTempChannel).not.toHaveBeenCalled();
  });

  it('handles error gracefully', async () => {
    const guild = mockGuild();
    const { getMonitoredChannels } = require('../../../src/services/tempChannelService');
    getMonitoredChannels.mockRejectedValueOnce(new Error('DB error'));

    const oldState = mockVoiceState({ channel: null, guild });
    const newState = mockVoiceState({ channel: null, guild });
    await expect(run(oldState, newState)).resolves.not.toThrow();
  });
});
