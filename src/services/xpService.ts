import { Client, GuildMember } from 'discord.js';
import { LevelModel } from '../models/Level';
import { LevelConfigModel } from '../models/LevelConfig';
import { ActivityBucketModel } from '../models/ActivityBucket';
import { deltaXp, xpForLevel, computeLevelProgress } from '../utils/levelMath';
import { getXpMultipliers } from '../utils/xpMultiplier';
import { notifyLevelUp } from './levelNotifier';
import { syncRewardRoles } from './rewardRoles';
import xpCache from '../cache/xpCache';
import logger from '../utils/logger';
import { ServiceResult, ok, fail } from '../types/serviceResult';

export async function modifyXp(client: Client, gid: string, uid: string, delta: number) {
  if (delta === 0) return;

  const cfg = await LevelConfigModel.findOne({ guildId: gid }).lean();
  const rewards = cfg?.roleRewards ?? [];

  const doc =
    (await LevelModel.findOne({ guildId: gid, userId: uid })) ??
    new LevelModel({ guildId: gid, userId: uid, xp: 0, level: 1 });

  let lvl = doc.level;
  let xp = doc.xp + delta;

  while (xp >= deltaXp(lvl + 1)) {
    xp -= deltaXp(lvl + 1);
    lvl++;
  }

  if (lvl !== doc.level) {
    await notifyLevelUp(client, gid, uid, lvl);
  }

  while (xp < 0 && lvl > 1) {
    lvl--;
    xp += deltaXp(lvl);
  }
  if (xp < 0) xp = 0;

  if (lvl < doc.level) {
    const g = client.guilds.cache.get(gid);
    if (g) {
      const m = await g.members.fetch(uid).catch(() => null);
      if (m) await syncRewardRoles(m, lvl, rewards);
    }
  }
  await LevelModel.updateOne({ guildId: gid, userId: uid }, { level: lvl, xp }, { upsert: true });

  xpCache.invalidateUser(gid, uid);
}

/* ── getCurrentXp ─────────────────────────────────────────────── */

/**
 * Get the current (potentially cached) XP and level for a user.
 */
export async function getCurrentXp(
  guildId: string,
  userId: string,
): Promise<{ level: number; xp: number }> {
  return xpCache.getCurrentXp(guildId, userId);
}

/* ── Result types ─────────────────────────────────────────────── */

export interface RankData {
  rank: number;
  totalUsers: number;
}

export interface LeaderboardEntry {
  userId: string;
  level: number;
  xp: number;
  totalXp: number;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  totalUsers: number;
  page: number;
  totalPages: number;
}

export interface SetXpData {
  level: number;
  xp: number;
  totalXp: number;
}

/* ── getUserRank ──────────────────────────────────────────────── */

export async function getUserRank(
  guildId: string,
  userId: string,
): Promise<ServiceResult<RankData>> {
  const allUsers = await LevelModel.find({ guildId }).lean();

  const sorted = allUsers
    .map((u) => ({ userId: u.userId, totalXp: xpForLevel(u.level) + u.xp }))
    .sort((a, b) => b.totalXp - a.totalXp);

  const idx = sorted.findIndex((u) => u.userId === userId);
  const rank = idx === -1 ? sorted.length + 1 : idx + 1;

  return ok({ rank, totalUsers: sorted.length });
}

/* ── getLeaderboard ───────────────────────────────────────────── */

export async function getLeaderboard(
  guildId: string,
  page: number = 1,
  perPage: number = 10,
): Promise<ServiceResult<LeaderboardData>> {
  const allUsers = await LevelModel.find({ guildId }).lean();

  const sorted = allUsers
    .map((u) => ({
      userId: u.userId,
      level: u.level,
      xp: u.xp,
      totalXp: xpForLevel(u.level) + u.xp,
    }))
    .sort((a, b) => b.totalXp - a.totalXp);

  const totalUsers = sorted.length;
  const totalPages = Math.ceil(totalUsers / perPage) || 1;

  if (totalUsers === 0) {
    return fail('NO_USERS', 'Brak użytkowników z poziomami na tym serwerze');
  }
  if (page < 1 || page > totalPages) {
    return fail('INVALID_PAGE', `Strona ${page} nie istnieje! Dostępne strony: 1-${totalPages}`);
  }

  const skip = (page - 1) * perPage;
  const entries = sorted.slice(skip, skip + perPage);

  return ok({ entries, totalUsers, page, totalPages });
}

/* ── setXp (absolute total XP) ────────────────────────────────── */

export async function setXp(
  guildId: string,
  userId: string,
  totalXp: number,
): Promise<ServiceResult<SetXpData>> {
  if (!Number.isFinite(totalXp) || totalXp < 0) {
    return fail('INVALID_VALUE', 'Wartość XP musi być liczbą >= 0');
  }

  const { level, xpIntoLevel } = computeLevelProgress(totalXp);

  await LevelModel.findOneAndUpdate(
    { guildId, userId },
    { level, xp: xpIntoLevel },
    { upsert: true },
  );

  xpCache.invalidateUser(guildId, userId);
  return ok({ level, xp: xpIntoLevel, totalXp });
}

/* ── setLevel ─────────────────────────────────────────────────── */

export async function setLevel(
  guildId: string,
  userId: string,
  level: number,
): Promise<ServiceResult<SetXpData>> {
  if (!Number.isFinite(level) || level < 1) {
    return fail('INVALID_VALUE', 'Poziom musi być liczbą >= 1');
  }

  await LevelModel.findOneAndUpdate(
    { guildId, userId },
    { level, xp: 0 },
    { upsert: true },
  );

  xpCache.invalidateUser(guildId, userId);
  return ok({ level, xp: 0, totalXp: xpForLevel(level) });
}

/* ── XpConfigData ─────────────────────────────────────────────── */

export interface XpConfigData {
  guildId: string;
  enabled: boolean;
  xpPerMsg: number;
  xpPerMinVc: number;
  cooldownSec: number;
  notifyChannelId?: string;
  enableLevelUpMessages: boolean;
  levelUpMessage: string;
  rewardMessage: string;
  roleRewards: { level: number; roleId: string; rewardMessage?: string }[];
  roleMultipliers: { roleId: string; multiplier: number }[];
  channelMultipliers: { channelId: string; multiplier: number }[];
  ignoredChannels: string[];
  ignoredRoles: string[];
}

/* ── getConfig ────────────────────────────────────────────────── */

export async function getConfig(guildId: string): Promise<XpConfigData | null> {
  const doc = await LevelConfigModel.findOne({ guildId }).lean();
  return doc ? (doc as unknown as XpConfigData) : null;
}

/* ── trackMessage ─────────────────────────────────────────────── */

export async function trackMessage(
  guildId: string,
  userId: string,
  channelId: string,
  member: GuildMember,
): Promise<boolean> {
  const cfg = await LevelConfigModel.findOne({ guildId }).lean();

  if (cfg?.ignoredChannels?.includes(channelId)) return false;
  if (cfg?.ignoredRoles?.some((r) => member.roles.cache.has(r))) return false;

  const cooldown = cfg?.cooldownSec ?? 0;
  if (cooldown > 0) {
    const doc = await LevelModel.findOne({ guildId, userId })
      .select('lastMessageTs')
      .lean();
    if (doc?.lastMessageTs && Date.now() - doc.lastMessageTs.getTime() < cooldown * 1000)
      return false;
  }

  const { role, channel } = getXpMultipliers(member, channelId, cfg);
  const xpPerMsg = cfg?.xpPerMsg ?? 5;
  const finalXp = Math.round(xpPerMsg * role * channel);

  await xpCache.addMsg(guildId, userId, finalXp);
  return true;
}

/* ── flush (XP bulk write) ────────────────────────────────────── */

export async function flush(): Promise<{ flushed: number }> {
  const batch = xpCache.drain();
  if (!batch.length) return { flushed: 0 };

  const lvlOps: Parameters<typeof LevelModel.bulkWrite>[0] = [];
  const bucketOps: Parameters<typeof ActivityBucketModel.bulkWrite>[0] = [];

  for (const [key, entry] of batch) {
    const [guildId, userId] = key.split(':');

    lvlOps.push({
      updateOne: {
        filter: { guildId, userId },
        update: {
          $set: {
            xp: entry.persistedXp + entry.levelDelta,
            level: entry.persistedLevel,
          },
          $max: {
            lastMessageTs: entry.lastMessageTs,
            lastVcUpdateTs: entry.lastVcUpdateTs,
          },
        },
        upsert: true,
      },
    });

    bucketOps.push({
      updateOne: {
        filter: { guildId, userId, bucketStart: entry.bucketStart },
        update: {
          $inc: {
            msgCount: entry.bucket.msgCount,
            vcMin: entry.bucket.vcMin,
          },
        },
        upsert: true,
      },
    });
  }

  try {
    if (lvlOps.length) await LevelModel.bulkWrite(lvlOps);
    if (bucketOps.length) await ActivityBucketModel.bulkWrite(bucketOps);
  } catch (err) {
    logger.error(`[XP-FLUSH] Error during flush: ${err}`);
  }

  return { flushed: batch.length };
}
