import { TempRoleModel } from '../models/TempRole';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

/* ── Types ──────────────────────────────────────────────────────────── */

export interface TempRoleEntry {
  guildId: string;
  userId: string;
  roleId: string;
  expiresAt: Date;
  assignedBy: string;
  reason?: string;
}

export interface ExpiredTempRole {
  guildId: string;
  userId: string;
  roleId: string;
}

/* ── Service functions ──────────────────────────────────────────────── */

/**
 * Add a temporary role entry.
 * If the same (guild + user + role) combo exists, the expiry is updated.
 */
export async function addTempRole(
  guildId: string,
  userId: string,
  roleId: string,
  durationMs: number,
  assignedBy: string,
  reason?: string
): Promise<ServiceResult<TempRoleEntry>> {
  try {
    const expiresAt = new Date(Date.now() + durationMs);

    const doc = await TempRoleModel.findOneAndUpdate(
      { guildId, userId, roleId },
      { guildId, userId, roleId, expiresAt, assignedBy, reason },
      { upsert: true, new: true }
    ).lean();

    return ok({
      guildId: doc.guildId,
      userId: doc.userId,
      roleId: doc.roleId,
      expiresAt: doc.expiresAt,
      assignedBy: doc.assignedBy,
      reason: doc.reason,
    });
  } catch (error) {
    logger.error(`[TempRoleService] addTempRole error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się zapisać tymczasowej roli.');
  }
}

/**
 * Remove a temp-role entry (e.g. when manually removed early).
 */
export async function removeTempRole(
  guildId: string,
  userId: string,
  roleId: string
): Promise<ServiceResult<boolean>> {
  try {
    const result = await TempRoleModel.deleteOne({ guildId, userId, roleId });
    return ok(result.deletedCount > 0);
  } catch (error) {
    logger.error(`[TempRoleService] removeTempRole error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się usunąć tymczasowej roli.');
  }
}

/**
 * List active temp roles for a user in a guild.
 */
export async function listTempRoles(
  guildId: string,
  userId?: string
): Promise<ServiceResult<TempRoleEntry[]>> {
  try {
    const filter: Record<string, string> = { guildId };
    if (userId) filter.userId = userId;

    const docs = await TempRoleModel.find(filter).sort({ expiresAt: 1 }).lean();

    return ok(
      docs.map((d) => ({
        guildId: d.guildId,
        userId: d.userId,
        roleId: d.roleId,
        expiresAt: d.expiresAt,
        assignedBy: d.assignedBy,
        reason: d.reason,
      }))
    );
  } catch (error) {
    logger.error(`[TempRoleService] listTempRoles error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się pobrać listy tymczasowych ról.');
  }
}

/**
 * Collect and delete all expired temp-role entries.
 * Returns the list so the caller (scheduler) can remove Discord roles.
 */
export async function collectExpiredTempRoles(): Promise<ServiceResult<ExpiredTempRole[]>> {
  const expired: ExpiredTempRole[] = [];

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const doc = await TempRoleModel.findOneAndDelete({
        expiresAt: { $lte: new Date() },
      }).lean();

      if (!doc) break;

      expired.push({
        guildId: doc.guildId,
        userId: doc.userId,
        roleId: doc.roleId,
      });
    }

    return ok(expired);
  } catch (error) {
    logger.error(`[TempRoleService] collectExpiredTempRoles error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się przetworzyć wygasłych ról.');
  }
}
