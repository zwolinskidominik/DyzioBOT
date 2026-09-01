import mongoose from 'mongoose';
import { AntiSpamConfigModel, AntiSpamPunishment, AntiSpamMode } from '../models/AntiSpamConfig';
import { AntiSpamIncidentModel } from '../models/AntiSpamIncident';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

export type AntiSpamRuleId = 'rate' | 'invites' | 'mentions' | 'repeat';

/* ── In-memory trackers (detekcja "na żywo", nie eskalacja) ─────────── */

/** Maps "guildId:userId" → array of message timestamps (epoch ms). Reguła 'rate'. */
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

export interface AntiSpamRuleSettings {
  on: boolean;
  deleteMessage: boolean;
  mode: AntiSpamMode;
  action: AntiSpamPunishment;
  steps: AntiSpamPunishment[];
  muteDuration: string;
  reset: string;
  threshold: number;
  windowSeconds: number;
  allowOwnServerInvites: boolean;
}

export interface AntiSpamSettings {
  enabled: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  rate: AntiSpamRuleSettings;
  invites: AntiSpamRuleSettings;
  mentions: AntiSpamRuleSettings;
  repeat: AntiSpamRuleSettings;
}

const BASE_RULE: AntiSpamRuleSettings = {
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

const DEFAULT_SETTINGS: AntiSpamSettings = {
  enabled: false,
  ignoredChannels: [],
  ignoredRoles: [],
  rate: { ...BASE_RULE, on: true, threshold: 5, windowSeconds: 3 },
  invites: { ...BASE_RULE, on: false },
  mentions: { ...BASE_RULE, on: false, threshold: 5 },
  repeat: { ...BASE_RULE, on: false, threshold: 3, windowSeconds: 30 },
};

function mergeRule(partial: Partial<AntiSpamRuleSettings> | undefined, fallback: AntiSpamRuleSettings): AntiSpamRuleSettings {
  if (!partial) return fallback;
  return {
    on: partial.on ?? fallback.on,
    deleteMessage: partial.deleteMessage ?? fallback.deleteMessage,
    mode: partial.mode ?? fallback.mode,
    action: partial.action ?? fallback.action,
    steps: partial.steps && partial.steps.length > 0 ? partial.steps : fallback.steps,
    muteDuration: partial.muteDuration ?? fallback.muteDuration,
    reset: partial.reset ?? fallback.reset,
    threshold: partial.threshold ?? fallback.threshold,
    windowSeconds: partial.windowSeconds ?? fallback.windowSeconds,
    allowOwnServerInvites: partial.allowOwnServerInvites ?? fallback.allowOwnServerInvites,
  };
}

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
          ignoredChannels: (doc.ignoredChannels as string[]) ?? DEFAULT_SETTINGS.ignoredChannels,
          ignoredRoles: (doc.ignoredRoles as string[]) ?? DEFAULT_SETTINGS.ignoredRoles,
          rate: mergeRule(doc.rate, DEFAULT_SETTINGS.rate),
          invites: mergeRule(doc.invites, DEFAULT_SETTINGS.invites),
          mentions: mergeRule(doc.mentions, DEFAULT_SETTINGS.mentions),
          repeat: mergeRule(doc.repeat, DEFAULT_SETTINGS.repeat),
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

/* ── Rate detection (reguła 'rate') ──────────────────────────────── */

export interface SpamCheckResult {
  isSpam: boolean;
  messageCount: number;
}

/**
 * Records a message and checks whether the user has exceeded the rate-limit threshold.
 */
export function trackMessage(guildId: string, userId: string, rule: AntiSpamRuleSettings): SpamCheckResult {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const cutoff = now - rule.windowSeconds * 1000;

  let timestamps = messageTracker.get(key) ?? [];
  timestamps.push(now);
  timestamps = timestamps.filter((t) => t > cutoff);
  messageTracker.set(key, timestamps);

  const isSpam = timestamps.length >= rule.threshold;

  return { isSpam, messageCount: timestamps.length };
}

/** Clears the rate-limit history for a specific user in a guild (after taking action). */
export function clearUserHistory(guildId: string, userId: string): void {
  messageTracker.delete(`${guildId}:${userId}`);
}

/* ── Repeat detection (reguła 'repeat') ──────────────────────────── */

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
 * (same text sent multiple times within the rule's window).
 */
export function trackFlood(
  guildId: string,
  userId: string,
  content: string,
  channelId: string,
  rule: AntiSpamRuleSettings
): FloodCheckResult {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const cutoff = now - rule.windowSeconds * 1000;

  let entries = floodTracker.get(key) ?? [];
  entries.push({ content: normalizeContent(content), channelId, timestamp: now });
  entries = entries.filter((e) => e.timestamp > cutoff);
  floodTracker.set(key, entries);

  const normalized = normalizeContent(content);
  const duplicates = entries.filter((e) => e.content === normalized);
  const channels = [...new Set(duplicates.map((e) => e.channelId))];

  return {
    isFlood: duplicates.length >= rule.threshold,
    duplicateCount: duplicates.length,
    channels,
  };
}

/** Clears repeat-message history for a user after action is taken. */
export function clearFloodHistory(guildId: string, userId: string): void {
  floodTracker.delete(`${guildId}:${userId}`);
}

/** Normalises message content for comparison: lowercase, collapse whitespace, trim. */
function normalizeContent(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ── Eskalacja (tryb 'ladder') i historia incydentów ─────────────── */

/**
 * Zwraca karę, jaką należy zastosować TERAZ dla danej reguły:
 * - tryb 'single' → zawsze `rule.action`,
 * - tryb 'ladder' → kolejny stopień na podstawie liczby incydentów tej reguły
 *   w oknie `rule.reset` godzin (ostatni stopień powtarza się dla kolejnych wykryć).
 */
export async function getNextPunishment(
  guildId: string,
  userId: string,
  ruleId: AntiSpamRuleId,
  rule: AntiSpamRuleSettings
): Promise<AntiSpamPunishment> {
  if (rule.mode !== 'ladder') return rule.action;

  const steps: AntiSpamPunishment[] = rule.steps.length > 0 ? rule.steps : ['warn'];

  try {
    const resetMs = Number(rule.reset) * 60 * 60 * 1000;
    const since = new Date(Date.now() - resetMs);
    // mongoose.trusted(): sanitizeFilter (index.ts) sanityzuje każdy ręcznie
    // pisany operator — bez tego rzuca CastError na $gte.
    const count = await AntiSpamIncidentModel.countDocuments({
      guildId,
      userId,
      rule: ruleId,
      createdAt: mongoose.trusted({ $gte: since }),
    });
    const idx = Math.min(count, steps.length - 1);
    return steps[idx];
  } catch (error) {
    logger.error(`AntiSpam: błąd odczytu eskalacji dla ${guildId}/${userId}/${ruleId}: ${error}`);
    return steps[0];
  }
}

/** Zapisuje wystąpienie zadziałania reguły — do eskalacji i statystyk. */
export async function recordIncident(
  guildId: string,
  userId: string,
  ruleId: AntiSpamRuleId,
  actionTaken: AntiSpamPunishment
): Promise<void> {
  try {
    await AntiSpamIncidentModel.create({ guildId, userId, rule: ruleId, actionTaken });
  } catch (error) {
    logger.error(`AntiSpam: błąd zapisu incydentu dla ${guildId}/${userId}/${ruleId}: ${error}`);
  }
}

/** Liczba interwencji na serwerze w ostatnich `hours` godzinach — do statystyki dashboardu. */
export async function countRecentIncidents(guildId: string, hours: number): Promise<number> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    // mongoose.trusted(): patrz komentarz w escalatePunishment wyżej.
    return await AntiSpamIncidentModel.countDocuments({ guildId, createdAt: mongoose.trusted({ $gte: since }) });
  } catch (error) {
    logger.error(`AntiSpam: błąd liczenia interwencji dla ${guildId}: ${error}`);
    return 0;
  }
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
