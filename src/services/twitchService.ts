import { ServiceResult, ok, fail } from '../types/serviceResult';
import { TwitchStreamerModel } from '../models/TwitchStreamer';

/* ── Types ────────────────────────────────────────────────── */

export interface TwitchStreamerData {
  guildId: string;
  twitchChannel: string;
  userId: string;
  isLive: boolean;
  active: boolean;
}

/* ── Service functions ────────────────────────────────────── */

/**
 * Get all active streamers for a guild.
 */
export async function getActiveStreamers(
  guildId?: string,
): Promise<ServiceResult<TwitchStreamerData[]>> {
  const filter: Record<string, unknown> = { active: true };
  if (guildId) filter.guildId = guildId;
  const docs = await TwitchStreamerModel.find(filter).lean();
  return ok(docs.map(toData));
}

/**
 * Add a new streamer to watch.
 */
export async function addStreamer(
  guildId: string,
  userId: string,
  twitchChannel: string,
): Promise<ServiceResult<TwitchStreamerData>> {
  const existing = await TwitchStreamerModel.findOne({
    guildId,
    twitchChannel: twitchChannel.toLowerCase(),
  });
  if (existing) {
    return fail('ALREADY_EXISTS', 'Ten streamer jest już na liście.');
  }

  const doc = await TwitchStreamerModel.create({
    guildId,
    userId,
    twitchChannel: twitchChannel.toLowerCase(),
    isLive: false,
    active: true,
  });
  return ok(toData(doc));
}

/**
 * Remove a streamer from the watch list.
 */
export async function removeStreamer(
  guildId: string,
  twitchChannel: string,
): Promise<ServiceResult<void>> {
  const result = await TwitchStreamerModel.findOneAndDelete({
    guildId,
    twitchChannel: twitchChannel.toLowerCase(),
  });
  if (!result) return fail('NOT_FOUND', 'Nie znaleziono takiego streamera.');
  return ok(undefined);
}

/**
 * Mark a streamer as live or offline.
 */
export async function setLiveStatus(
  guildId: string,
  twitchChannel: string,
  isLive: boolean,
): Promise<ServiceResult<void>> {
  const doc = await TwitchStreamerModel.findOneAndUpdate(
    { guildId, twitchChannel: twitchChannel.toLowerCase() },
    { isLive },
    { new: true },
  );
  if (!doc) return fail('NOT_FOUND', 'Nie znaleziono streamera.');
  return ok(undefined);
}

/**
 * List all streamers for a guild (including inactive).
 */
export async function listStreamers(
  guildId: string,
): Promise<ServiceResult<TwitchStreamerData[]>> {
  const docs = await TwitchStreamerModel.find({ guildId }).lean();
  return ok(docs.map(toData));
}

/* ── Internal helpers ─────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toData(doc: any): TwitchStreamerData {
  return {
    guildId: doc.guildId,
    twitchChannel: doc.twitchChannel,
    userId: doc.userId,
    isLive: doc.isLive,
    active: doc.active,
  };
}
