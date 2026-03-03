import { InviteEntryModel } from '../models/InviteEntry';
import { InviteTrackerConfigModel } from '../models/InviteTrackerConfig';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

/* ── Types ───────────────────────────────────────────────────────── */

export interface InviteStats {
  inviterId: string;
  total: number;
  active: number;
  left: number;
  fake: number;
}

export interface InviteLeaderboardEntry extends InviteStats {
  rank: number;
}

export interface RecordJoinParams {
  guildId: string;
  joinedUserId: string;
  inviterId: string | null;
  inviteCode: string | null;
  accountCreatedAt: Date;
}

/* ── Config ──────────────────────────────────────────────────────── */

export async function getConfig(guildId: string): Promise<ServiceResult<{
  enabled: boolean;
  logChannelId: string | null;
  joinMessage: string;
  leaveMessage: string;
}>> {
  try {
    const config = await InviteTrackerConfigModel.findOne({ guildId }).lean();
    return ok({
      enabled: config?.enabled ?? false,
      logChannelId: config?.logChannelId ?? null,
      joinMessage: config?.joinMessage ?? '',
      leaveMessage: config?.leaveMessage ?? '',
    });
  } catch (error) {
    logger.error(`[InviteTracker] getConfig error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się pobrać konfiguracji invite trackera.');
  }
}

export async function updateConfig(guildId: string, data: {
  enabled?: boolean;
  logChannelId?: string | null;
  joinMessage?: string;
  leaveMessage?: string;
}): Promise<ServiceResult<{ updated: boolean }>> {
  try {
    await InviteTrackerConfigModel.findOneAndUpdate(
      { guildId },
      { guildId, ...data },
      { upsert: true, new: true },
    );
    return ok({ updated: true });
  } catch (error) {
    logger.error(`[InviteTracker] updateConfig error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się zaktualizować konfiguracji.');
  }
}

/* ── Record join/leave ───────────────────────────────────────────── */

const FAKE_THRESHOLD_DAYS = 7;

export async function recordJoin(params: RecordJoinParams): Promise<ServiceResult<{
  inviterId: string | null;
  fake: boolean;
}>> {
  try {
    const { guildId, joinedUserId, inviterId, inviteCode, accountCreatedAt } = params;

    const accountAgeMs = Date.now() - accountCreatedAt.getTime();
    const isFake = accountAgeMs < FAKE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    await InviteEntryModel.create({
      guildId,
      joinedUserId,
      inviterId,
      inviteCode,
      active: true,
      fake: isFake,
      joinedAt: new Date(),
    });

    return ok({ inviterId, fake: isFake });
  } catch (error) {
    logger.error(`[InviteTracker] recordJoin error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się zapisać dołączenia.');
  }
}

export async function recordLeave(guildId: string, userId: string): Promise<ServiceResult<{
  inviterId: string | null;
}>> {
  try {
    // Mark the most recent active entry for this user as left
    const entry = await InviteEntryModel.findOneAndUpdate(
      { guildId, joinedUserId: userId, active: true },
      { active: false, leftAt: new Date() },
      { sort: { joinedAt: -1 }, new: true },
    );

    return ok({ inviterId: entry?.inviterId ?? null });
  } catch (error) {
    logger.error(`[InviteTracker] recordLeave error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się zapisać opuszczenia.');
  }
}

/* ── Statistics ──────────────────────────────────────────────────── */

export async function getInviterStats(guildId: string, inviterId: string): Promise<ServiceResult<InviteStats>> {
  try {
    const entries = await InviteEntryModel.find({ guildId, inviterId }).lean();

    const total = entries.length;
    const active = entries.filter((e) => e.active && !e.fake).length;
    const left = entries.filter((e) => !e.active).length;
    const fake = entries.filter((e) => e.fake).length;

    return ok({ inviterId, total, active, left, fake });
  } catch (error) {
    logger.error(`[InviteTracker] getInviterStats error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się pobrać statystyk.');
  }
}

export async function getLeaderboard(guildId: string, limit = 10): Promise<ServiceResult<InviteLeaderboardEntry[]>> {
  try {
    const pipeline = [
      { $match: { guildId, inviterId: { $ne: null } } },
      {
        $group: {
          _id: '$inviterId',
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$active', true] }, { $eq: ['$fake', false] }] }, 1, 0],
            },
          },
          left: { $sum: { $cond: [{ $eq: ['$active', false] }, 1, 0] } },
          fake: { $sum: { $cond: [{ $eq: ['$fake', true] }, 1, 0] } },
        },
      },
      { $sort: { active: -1 as const, total: -1 as const } },
      { $limit: limit },
    ];

    const results = await InviteEntryModel.aggregate(pipeline);

    const leaderboard: InviteLeaderboardEntry[] = results.map((r, i) => ({
      inviterId: r._id as string,
      total: r.total as number,
      active: r.active as number,
      left: r.left as number,
      fake: r.fake as number,
      rank: i + 1,
    }));

    return ok(leaderboard);
  } catch (error) {
    logger.error(`[InviteTracker] getLeaderboard error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się pobrać rankingu.');
  }
}

/**
 * Returns invite entries for a specific guild, with optional filters.
 */
export async function getEntries(
  guildId: string,
  options: { inviterId?: string; limit?: number; skip?: number } = {},
): Promise<ServiceResult<{ entries: any[]; totalCount: number }>> {
  try {
    const filter: any = { guildId };
    if (options.inviterId) filter.inviterId = options.inviterId;

    const [entries, totalCount] = await Promise.all([
      InviteEntryModel.find(filter)
        .sort({ joinedAt: -1 })
        .skip(options.skip ?? 0)
        .limit(options.limit ?? 50)
        .lean(),
      InviteEntryModel.countDocuments(filter),
    ]);

    return ok({ entries, totalCount });
  } catch (error) {
    logger.error(`[InviteTracker] getEntries error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się pobrać wpisów.');
  }
}
