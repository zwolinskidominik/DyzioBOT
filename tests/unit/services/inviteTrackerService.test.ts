import { InviteTrackerConfigModel } from '../../../src/models/InviteTrackerConfig';
import { InviteEntryModel } from '../../../src/models/InviteEntry';
import {
  getConfig,
  updateConfig,
  recordJoin,
  recordLeave,
  getInviterStats,
  getLeaderboard,
  getEntries,
} from '../../../src/services/inviteTrackerService';

const GID = 'guild-invite-test';

beforeEach(async () => {
  await InviteTrackerConfigModel.deleteMany({});
  await InviteEntryModel.deleteMany({});
});

/* ── getConfig ─────────────────────────────────────────────── */

describe('getConfig', () => {
  it('returns defaults when no config exists', async () => {
    const res = await getConfig(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.enabled).toBe(false);
    expect(res.data.logChannelId).toBeNull();
    expect(res.data.joinMessage).toBe('');
    expect(res.data.joinMessageUnknown).toBe('');
    expect(res.data.joinMessageVanity).toBe('');
    expect(res.data.leaveMessage).toBe('');
  });

  it('returns saved config', async () => {
    await InviteTrackerConfigModel.create({
      guildId: GID,
      enabled: true,
      logChannelId: 'ch-1',
      joinMessage: 'Welcome {user}!',
      joinMessageUnknown: 'Unknown joiner',
      joinMessageVanity: 'Vanity join',
      leaveMessage: 'Bye {user}!',
    });

    const res = await getConfig(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.enabled).toBe(true);
    expect(res.data.logChannelId).toBe('ch-1');
    expect(res.data.joinMessage).toBe('Welcome {user}!');
    expect(res.data.joinMessageUnknown).toBe('Unknown joiner');
    expect(res.data.joinMessageVanity).toBe('Vanity join');
  });
});

/* ── updateConfig ──────────────────────────────────────────── */

describe('updateConfig', () => {
  it('creates config via upsert', async () => {
    const res = await updateConfig(GID, { enabled: true, logChannelId: 'ch-2' });
    expect(res.ok).toBe(true);

    const saved = await InviteTrackerConfigModel.findOne({ guildId: GID });
    expect(saved?.enabled).toBe(true);
    expect(saved?.logChannelId).toBe('ch-2');
  });

  it('updates existing config', async () => {
    await InviteTrackerConfigModel.create({ guildId: GID, enabled: false });
    await updateConfig(GID, { enabled: true, joinMessage: 'Hello!' });

    const saved = await InviteTrackerConfigModel.findOne({ guildId: GID });
    expect(saved?.enabled).toBe(true);
    expect(saved?.joinMessage).toBe('Hello!');
  });
});

/* ── recordJoin ────────────────────────────────────────────── */

describe('recordJoin', () => {
  it('records a join entry', async () => {
    const res = await recordJoin({
      guildId: GID,
      joinedUserId: 'user-1',
      inviterId: 'inviter-1',
      inviteCode: 'abc123',
      accountCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.inviterId).toBe('inviter-1');
    expect(res.data.fake).toBe(false);

    const entry = await InviteEntryModel.findOne({ guildId: GID, joinedUserId: 'user-1' });
    expect(entry).not.toBeNull();
    expect(entry?.active).toBe(true);
    expect(entry?.inviteCode).toBe('abc123');
  });

  it('marks fake account (< 7 days old)', async () => {
    const res = await recordJoin({
      guildId: GID,
      joinedUserId: 'user-new',
      inviterId: 'inviter-1',
      inviteCode: null,
      accountCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days old
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.fake).toBe(true);

    const entry = await InviteEntryModel.findOne({ guildId: GID, joinedUserId: 'user-new' });
    expect(entry?.fake).toBe(true);
  });

  it('handles null inviter', async () => {
    const res = await recordJoin({
      guildId: GID,
      joinedUserId: 'user-2',
      inviterId: null,
      inviteCode: null,
      accountCreatedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.inviterId).toBeNull();
  });
});

/* ── recordLeave ───────────────────────────────────────────── */

describe('recordLeave', () => {
  it('marks the user entry as inactive', async () => {
    await InviteEntryModel.create({
      guildId: GID,
      joinedUserId: 'user-1',
      inviterId: 'inviter-1',
      active: true,
    });

    const res = await recordLeave(GID, 'user-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.inviterId).toBe('inviter-1');

    const entry = await InviteEntryModel.findOne({ guildId: GID, joinedUserId: 'user-1' });
    expect(entry?.active).toBe(false);
    expect(entry?.leftAt).not.toBeNull();
  });

  it('returns null inviter if no entry found', async () => {
    const res = await recordLeave(GID, 'unknown-user');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.inviterId).toBeNull();
  });
});

/* ── getInviterStats ───────────────────────────────────────── */

describe('getInviterStats', () => {
  it('returns correct stats', async () => {
    await InviteEntryModel.create([
      { guildId: GID, joinedUserId: 'u1', inviterId: 'inviter-1', active: true, fake: false },
      { guildId: GID, joinedUserId: 'u2', inviterId: 'inviter-1', active: true, fake: true },
      { guildId: GID, joinedUserId: 'u3', inviterId: 'inviter-1', active: false, fake: false },
    ]);

    const res = await getInviterStats(GID, 'inviter-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.total).toBe(3);
    expect(res.data.active).toBe(1); // active & not fake
    expect(res.data.left).toBe(1);
    expect(res.data.fake).toBe(1);
  });
});

/* ── getLeaderboard ────────────────────────────────────────── */

describe('getLeaderboard', () => {
  it('returns sorted leaderboard', async () => {
    await InviteEntryModel.create([
      { guildId: GID, joinedUserId: 'u1', inviterId: 'top-inviter', active: true, fake: false },
      { guildId: GID, joinedUserId: 'u2', inviterId: 'top-inviter', active: true, fake: false },
      { guildId: GID, joinedUserId: 'u3', inviterId: 'second-inviter', active: true, fake: false },
    ]);

    const res = await getLeaderboard(GID, 10);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.length).toBe(2);
    expect(res.data[0].inviterId).toBe('top-inviter');
    expect(res.data[0].active).toBe(2);
    expect(res.data[0].rank).toBe(1);
    expect(res.data[1].inviterId).toBe('second-inviter');
    expect(res.data[1].rank).toBe(2);
  });

  it('respects limit', async () => {
    await InviteEntryModel.create([
      { guildId: GID, joinedUserId: 'u1', inviterId: 'a', active: true, fake: false },
      { guildId: GID, joinedUserId: 'u2', inviterId: 'b', active: true, fake: false },
      { guildId: GID, joinedUserId: 'u3', inviterId: 'c', active: true, fake: false },
    ]);

    const res = await getLeaderboard(GID, 2);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.length).toBe(2);
  });

  it('excludes null inviters', async () => {
    await InviteEntryModel.create([
      { guildId: GID, joinedUserId: 'u1', inviterId: null, active: true, fake: false },
    ]);

    const res = await getLeaderboard(GID, 10);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.length).toBe(0);
  });
});

/* ── getEntries ────────────────────────────────────────────── */

describe('getEntries', () => {
  it('returns paginated entries', async () => {
    for (let i = 0; i < 5; i++) {
      await InviteEntryModel.create({
        guildId: GID,
        joinedUserId: `u${i}`,
        inviterId: 'inviter-1',
        active: true,
      });
    }

    const res = await getEntries(GID, { limit: 3 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.entries.length).toBe(3);
    expect(res.data.totalCount).toBe(5);
  });

  it('filters by inviterId', async () => {
    await InviteEntryModel.create([
      { guildId: GID, joinedUserId: 'u1', inviterId: 'a' },
      { guildId: GID, joinedUserId: 'u2', inviterId: 'b' },
    ]);

    const res = await getEntries(GID, { inviterId: 'a' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.entries.length).toBe(1);
    expect(res.data.totalCount).toBe(1);
  });
});
