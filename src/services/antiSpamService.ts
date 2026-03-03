import { AntiSpamConfigModel, AntiSpamAction } from '../models/AntiSpamConfig';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

/* ── In-memory message tracker ───────────────────────────────────── */

/** Maps "guildId:userId" → array of message timestamps (epoch ms). */
const messageTracker = new Map<string, number[]>();

/** Interval (ms) between automatic cleanups of stale entries. */
const CLEANUP_INTERVAL_MS = 60_000;

/** Maximum age (ms) of timestamps kept in memory. */
const MAX_TIMESTAMP_AGE_MS = 30_000;

/* ── Periodic cleanup ────────────────────────────────────────────── */

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of messageTracker) {
      const fresh = timestamps.filter((t) => now - t < MAX_TIMESTAMP_AGE_MS);
      if (fresh.length === 0) {
        messageTracker.delete(key);
      } else {
        messageTracker.set(key, fresh);
      }
    }
    for (const [key, entries] of floodTracker) {
      const fresh = entries.filter((e) => now - e.timestamp < MAX_TIMESTAMP_AGE_MS);
      if (fresh.length === 0) {
        floodTracker.delete(key);
      } else {
        floodTracker.set(key, fresh);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export function stopCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/* ── Config types & defaults ─────────────────────────────────────── */

export interface AntiSpamSettings {
  enabled: boolean;
  messageThreshold: number;
  timeWindowMs: number;
  action: AntiSpamAction;
  timeoutDurationMs: number;
  deleteMessages: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  blockInviteLinks: boolean;
  blockMassMentions: boolean;
  maxMentionsPerMessage: number;
  blockEveryoneHere: boolean;
  blockFlood: boolean;
  floodThreshold: number;
  floodWindowMs: number;
}

const DEFAULT_SETTINGS: AntiSpamSettings = {
  enabled: false,
  messageThreshold: 5,
  timeWindowMs: 3000,
  action: 'timeout',
  timeoutDurationMs: 5 * 60 * 1000,
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

/* ── Config cache (per guild, TTL-based) ─────────────────────────── */

interface CachedConfig {
  settings: AntiSpamSettings;
  expiresAt: number;
}

const CONFIG_CACHE_TTL_MS = 60_000;
const configCache = new Map<string, CachedConfig>();

export async function getConfig(guildId: string): Promise<AntiSpamSettings> {
  const cached = configCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.settings;
  }

  try {
    const doc = await AntiSpamConfigModel.findOne({ guildId }).lean();
    const settings: AntiSpamSettings = doc
      ? {
          enabled: doc.enabled ?? DEFAULT_SETTINGS.enabled,
          messageThreshold: doc.messageThreshold ?? DEFAULT_SETTINGS.messageThreshold,
          timeWindowMs: doc.timeWindowMs ?? DEFAULT_SETTINGS.timeWindowMs,
          action: (doc.action as AntiSpamAction) ?? DEFAULT_SETTINGS.action,
          timeoutDurationMs: doc.timeoutDurationMs ?? DEFAULT_SETTINGS.timeoutDurationMs,
          deleteMessages: doc.deleteMessages ?? DEFAULT_SETTINGS.deleteMessages,
          ignoredChannels: (doc.ignoredChannels as string[]) ?? DEFAULT_SETTINGS.ignoredChannels,
          ignoredRoles: (doc.ignoredRoles as string[]) ?? DEFAULT_SETTINGS.ignoredRoles,
          blockInviteLinks: doc.blockInviteLinks ?? DEFAULT_SETTINGS.blockInviteLinks,
          blockMassMentions: doc.blockMassMentions ?? DEFAULT_SETTINGS.blockMassMentions,
          maxMentionsPerMessage: doc.maxMentionsPerMessage ?? DEFAULT_SETTINGS.maxMentionsPerMessage,
          blockEveryoneHere: doc.blockEveryoneHere ?? DEFAULT_SETTINGS.blockEveryoneHere,
          blockFlood: doc.blockFlood ?? DEFAULT_SETTINGS.blockFlood,
          floodThreshold: doc.floodThreshold ?? DEFAULT_SETTINGS.floodThreshold,
          floodWindowMs: doc.floodWindowMs ?? DEFAULT_SETTINGS.floodWindowMs,
        }
      : { ...DEFAULT_SETTINGS };

    configCache.set(guildId, {
      settings,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
    });

    return settings;
  } catch (error) {
    logger.error(`AntiSpam: błąd odczytu konfiguracji dla ${guildId}: ${error}`);
    return { ...DEFAULT_SETTINGS };
  }
}

/* ── Spam detection result ───────────────────────────────────────── */

export interface SpamCheckResult {
  isSpam: boolean;
  messageCount: number;
  settings: AntiSpamSettings;
}

/* ── Flood detection ─────────────────────────────────────────────── */

interface FloodEntry {
  content: string;
  channelId: string;
  timestamp: number;
}

/** Maps "guildId:userId" → array of recent messages (content + channel + time). */
const floodTracker = new Map<string, FloodEntry[]>();

export interface FloodCheckResult {
  isFlood: boolean;
  duplicateCount: number;
  /** Channel IDs affected by the flood. */
  channels: string[];
}

/**
 * Records a message content and checks whether the user is flooding
 * (same/similar text sent multiple times across channels).
 */
export function trackFlood(
  guildId: string,
  userId: string,
  content: string,
  channelId: string,
  settings: AntiSpamSettings
): FloodCheckResult {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const cutoff = now - settings.floodWindowMs;

  let entries = floodTracker.get(key) ?? [];
  entries.push({ content: normalizeContent(content), channelId, timestamp: now });
  entries = entries.filter((e) => e.timestamp > cutoff);
  floodTracker.set(key, entries);

  const normalized = normalizeContent(content);
  const duplicates = entries.filter((e) => e.content === normalized);
  const channels = [...new Set(duplicates.map((e) => e.channelId))];

  return {
    isFlood: duplicates.length >= settings.floodThreshold,
    duplicateCount: duplicates.length,
    channels,
  };
}

/**
 * Clears flood history for a user after action is taken.
 */
export function clearFloodHistory(guildId: string, userId: string): void {
  floodTracker.delete(`${guildId}:${userId}`);
}

/**
 * Normalises message content for comparison:
 * lowercase, collapse whitespace, trim.
 */
function normalizeContent(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ── Core detection ──────────────────────────────────────────────── */

/**
 * Records a message and checks whether the user has exceeded the spam threshold.
 *
 * @returns `SpamCheckResult` with `isSpam: true` if the threshold is exceeded.
 */
export function trackMessage(
  guildId: string,
  userId: string,
  settings: AntiSpamSettings
): SpamCheckResult {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const cutoff = now - settings.timeWindowMs;

  let timestamps = messageTracker.get(key) ?? [];
  timestamps.push(now);
  timestamps = timestamps.filter((t) => t > cutoff);
  messageTracker.set(key, timestamps);

  const isSpam = timestamps.length >= settings.messageThreshold;

  return { isSpam, messageCount: timestamps.length, settings };
}

/**
 * Clears the message history for a specific user in a guild.
 * Called after taking action so they don't keep re-triggering.
 */
export function clearUserHistory(guildId: string, userId: string): void {
  messageTracker.delete(`${guildId}:${userId}`);
}

/* ── Config management ───────────────────────────────────────────── */

export interface UpdateConfigData {
  settings: AntiSpamSettings;
}

export async function updateConfig(
  guildId: string,
  updates: Partial<AntiSpamSettings>
): Promise<ServiceResult<UpdateConfigData>> {
  try {
    await AntiSpamConfigModel.findOneAndUpdate(
      { guildId },
      { $set: { ...updates, guildId } },
      { upsert: true, new: true }
    ).lean();

    // Invalidate cache
    configCache.delete(guildId);

    const settings = await getConfig(guildId);
    return ok({ settings });
  } catch (error) {
    logger.error(`AntiSpam: błąd zapisu konfiguracji dla ${guildId}: ${error}`);
    return fail('DB_ERROR', 'Nie udało się zapisać konfiguracji anti-spam.');
  }
}

/* ── Testing helpers ─────────────────────────────────────────────── */

/** @internal — For testing only: clear all in-memory state. */
export function _resetForTesting(): void {
  messageTracker.clear();
  floodTracker.clear();
  configCache.clear();
  stopCleanup();
}

/** @internal — For testing only: read the message tracker. */
export function _getTracker(): Map<string, number[]> {
  return messageTracker;
}
