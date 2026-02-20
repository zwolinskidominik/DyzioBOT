import { ServiceResult, ok, fail } from '../types/serviceResult';
import { MonthlyStatsModel } from '../models/MonthlyStats';
import { MonthlyStatsConfigModel } from '../models/MonthlyStatsConfig';

/* ── Types ────────────────────────────────────────────────── */

export interface MonthlyStatEntry {
  userId: string;
  messageCount: number;
  voiceMinutes: number;
}

export interface LeaderboardResult {
  topMessages: MonthlyStatEntry[];
  topVoice: MonthlyStatEntry[];
  totalMessages: number;
  month: string;
  topCount: number;
}

export interface PersonalStatsResult {
  messageCount: number;
  voiceMinutes: number;
  messageRank: number;
  voiceRank: number;
  totalUsers: number;
  totalMessages: number;
}

export interface TrendInfo {
  currentRank: number;
  previousRank: number;
  isNew: boolean;
}

export interface MonthlyStatsConfig {
  enabled: boolean;
  channelId?: string;
  topCount: number;
}

/* ── Pure helpers ─────────────────────────────────────────── */

export const MONTH_NAMES: Record<string, string> = {
  '01': 'STYCZEŃ',
  '02': 'LUTY',
  '03': 'MARZEC',
  '04': 'KWIECIEŃ',
  '05': 'MAJ',
  '06': 'CZERWIEC',
  '07': 'LIPIEC',
  '08': 'SIERPIEŃ',
  '09': 'WRZESIEŃ',
  '10': 'PAŹDZIERNIK',
  '11': 'LISTOPAD',
  '12': 'GRUDZIEŃ',
};

/**
 * Pure function: pick a trend emoji based on rank movement.
 */
export function getTrendEmoji(
  currentRank: number,
  previousRank: number,
  isNew: boolean,
  emojis: { upvote: string; downvote: string; whitedash: string; new: string },
): string {
  if (isNew) return emojis.new;
  if (previousRank === 0) return emojis.upvote;
  if (currentRank < previousRank) return emojis.upvote;
  if (currentRank > previousRank) return emojis.downvote;
  return emojis.whitedash;
}

/**
 * Pure function: format voice minutes as `H:MMh` string.
 */
export function formatVoiceTime(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}h` : `${hours}h`;
  }
  return `${minutes} min`;
}

/**
 * Get the month string for N months before `baseDate` (YYYY-MM format).
 */
export function getMonthString(baseDate: Date, monthsAgo = 0): string {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString().slice(0, 7);
}

/* ── Service functions ────────────────────────────────────── */

/**
 * Get the monthly stats config for a guild.
 */
export async function getConfig(guildId: string): Promise<ServiceResult<MonthlyStatsConfig>> {
  const config = await MonthlyStatsConfigModel.findOne({ guildId }).lean();
  if (!config) return fail('NO_CONFIG', 'Brak konfiguracji statystyk miesięcznych.');
  return ok({
    enabled: config.enabled,
    channelId: config.channelId,
    topCount: config.topCount,
  });
}

/**
 * Generate the leaderboard for a given month.
 */
export async function generateLeaderboard(
  guildId: string,
  month: string,
  topCount: number,
): Promise<ServiceResult<LeaderboardResult>> {
  const stats = await MonthlyStatsModel.find({ guildId, month }).lean();

  const topMessages = [...stats]
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, topCount)
    .map(s => ({ userId: s.userId, messageCount: s.messageCount, voiceMinutes: s.voiceMinutes }));

  const topVoice = [...stats]
    .sort((a, b) => b.voiceMinutes - a.voiceMinutes)
    .slice(0, topCount)
    .map(s => ({ userId: s.userId, messageCount: s.messageCount, voiceMinutes: s.voiceMinutes }));

  const totalMessages = stats.reduce((sum, s) => sum + s.messageCount, 0);

  return ok({ topMessages, topVoice, totalMessages, month, topCount });
}

/**
 * Get the rank of a user in a given month for a given stat type.
 * Returns 0 if the user is not found.
 */
export async function getUserRank(
  guildId: string,
  userId: string,
  month: string,
  type: 'messages' | 'voice',
): Promise<number> {
  const stats = await MonthlyStatsModel.find({ guildId, month }).lean();
  const sorted = type === 'messages'
    ? stats.sort((a, b) => b.messageCount - a.messageCount)
    : stats.sort((a, b) => b.voiceMinutes - a.voiceMinutes);
  const idx = sorted.findIndex(s => s.userId === userId);
  return idx + 1; // 0 if not found (-1 + 1)
}

/**
 * Check whether a user is new (only 1 or fewer monthly records).
 */
export async function isNewUser(guildId: string, userId: string): Promise<boolean> {
  const count = await MonthlyStatsModel.countDocuments({ guildId, userId });
  return count <= 1;
}

/**
 * Get personal stats for a user in a given month.
 */
export async function getPersonalStats(
  guildId: string,
  userId: string,
  month: string,
): Promise<ServiceResult<PersonalStatsResult>> {
  const stats = await MonthlyStatsModel.find({ guildId, month }).lean();
  const user = stats.find(s => s.userId === userId);

  if (!user) {
    return fail('NO_STATS', 'Brak statystyk za ten miesiąc.');
  }

  const messageSorted = [...stats].sort((a, b) => b.messageCount - a.messageCount);
  const voiceSorted = [...stats].sort((a, b) => b.voiceMinutes - a.voiceMinutes);

  const totalMessages = stats.reduce((sum, s) => sum + s.messageCount, 0);

  return ok({
    messageCount: user.messageCount,
    voiceMinutes: user.voiceMinutes,
    messageRank: messageSorted.findIndex(s => s.userId === userId) + 1,
    voiceRank: voiceSorted.findIndex(s => s.userId === userId) + 1,
    totalUsers: stats.length,
    totalMessages,
  });
}
