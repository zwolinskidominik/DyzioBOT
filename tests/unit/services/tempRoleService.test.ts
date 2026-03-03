/**
 * Unit tests for tempRoleService — CRUD operations and expiry collection.
 */
import { TempRoleModel } from '../../../src/models/TempRole';
import {
  addTempRole,
  removeTempRole,
  listTempRoles,
  collectExpiredTempRoles,
} from '../../../src/services/tempRoleService';

const GID = 'guild-temprole';
const UID = 'user-1';
const RID = 'role-1';

beforeEach(async () => {
  await TempRoleModel.deleteMany({});
});

/* ── addTempRole ──────────────────────────────────────────── */
describe('addTempRole', () => {
  it('creates a new temp role entry', async () => {
    const result = await addTempRole(GID, UID, RID, 60_000, 'mod-1', 'test reason');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.guildId).toBe(GID);
    expect(result.data.userId).toBe(UID);
    expect(result.data.roleId).toBe(RID);
    expect(result.data.assignedBy).toBe('mod-1');
    expect(result.data.reason).toBe('test reason');
    expect(result.data.expiresAt).toBeInstanceOf(Date);
    expect(result.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('upserts when same guild+user+role combo exists', async () => {
    await addTempRole(GID, UID, RID, 60_000, 'mod-1');
    const result = await addTempRole(GID, UID, RID, 120_000, 'mod-2', 'updated');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.assignedBy).toBe('mod-2');
    expect(result.data.reason).toBe('updated');

    const count = await TempRoleModel.countDocuments({ guildId: GID, userId: UID, roleId: RID });
    expect(count).toBe(1);
  });

  it('allows different roles for the same user', async () => {
    await addTempRole(GID, UID, 'role-a', 60_000, 'mod-1');
    await addTempRole(GID, UID, 'role-b', 60_000, 'mod-1');
    const count = await TempRoleModel.countDocuments({ guildId: GID, userId: UID });
    expect(count).toBe(2);
  });
});

/* ── removeTempRole ───────────────────────────────────────── */
describe('removeTempRole', () => {
  it('deletes existing entry and returns true', async () => {
    await addTempRole(GID, UID, RID, 60_000, 'mod-1');
    const result = await removeTempRole(GID, UID, RID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);

    const count = await TempRoleModel.countDocuments({ guildId: GID, userId: UID, roleId: RID });
    expect(count).toBe(0);
  });

  it('returns false when entry does not exist', async () => {
    const result = await removeTempRole(GID, UID, 'nonexistent');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(false);
  });
});

/* ── listTempRoles ────────────────────────────────────────── */
describe('listTempRoles', () => {
  it('returns all entries for a guild', async () => {
    await addTempRole(GID, 'u1', 'r1', 60_000, 'mod-1');
    await addTempRole(GID, 'u2', 'r2', 120_000, 'mod-1');
    await addTempRole('other-guild', 'u3', 'r3', 60_000, 'mod-1');

    const result = await listTempRoles(GID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
  });

  it('filters by userId when provided', async () => {
    await addTempRole(GID, 'u1', 'r1', 60_000, 'mod-1');
    await addTempRole(GID, 'u1', 'r2', 60_000, 'mod-1');
    await addTempRole(GID, 'u2', 'r3', 60_000, 'mod-1');

    const result = await listTempRoles(GID, 'u1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data.every((e) => e.userId === 'u1')).toBe(true);
  });

  it('returns empty array when no entries', async () => {
    const result = await listTempRoles(GID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it('sorts by expiresAt ascending', async () => {
    await addTempRole(GID, 'u1', 'r1', 120_000, 'mod-1');
    await addTempRole(GID, 'u2', 'r2', 30_000, 'mod-1');

    const result = await listTempRoles(GID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].userId).toBe('u2'); // shorter expiry first
    expect(result.data[1].userId).toBe('u1');
  });
});

/* ── collectExpiredTempRoles ──────────────────────────────── */
describe('collectExpiredTempRoles', () => {
  it('collects and deletes expired entries', async () => {
    // Insert an already-expired entry
    await TempRoleModel.create({
      guildId: GID,
      userId: UID,
      roleId: RID,
      expiresAt: new Date(Date.now() - 10_000),
      assignedBy: 'mod-1',
    });

    const result = await collectExpiredTempRoles();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ guildId: GID, userId: UID, roleId: RID });

    const count = await TempRoleModel.countDocuments({});
    expect(count).toBe(0);
  });

  it('does not collect non-expired entries', async () => {
    await addTempRole(GID, UID, RID, 600_000, 'mod-1');

    const result = await collectExpiredTempRoles();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);

    const count = await TempRoleModel.countDocuments({});
    expect(count).toBe(1);
  });

  it('collects multiple expired entries from different guilds', async () => {
    await TempRoleModel.create({
      guildId: 'g1', userId: 'u1', roleId: 'r1',
      expiresAt: new Date(Date.now() - 5_000), assignedBy: 'mod-1',
    });
    await TempRoleModel.create({
      guildId: 'g2', userId: 'u2', roleId: 'r2',
      expiresAt: new Date(Date.now() - 1_000), assignedBy: 'mod-1',
    });
    await addTempRole('g3', 'u3', 'r3', 600_000, 'mod-1'); // not expired

    const result = await collectExpiredTempRoles();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);

    const remaining = await TempRoleModel.countDocuments({});
    expect(remaining).toBe(1);
  });

  it('returns empty array when nothing is expired', async () => {
    const result = await collectExpiredTempRoles();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });
});
