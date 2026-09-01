import { ServiceResult, ok, fail } from '../types/serviceResult';
import { TwitchStreamerModel } from '../models/TwitchStreamer';
import { StreamNotificationLogModel } from '../models/StreamNotificationLog';
import { validateTwitchUser } from '../utils/twitchApi';

/* ── Types ────────────────────────────────────────────────── */

export interface TwitchStreamerData {
  guildId: string;
  twitchChannel: string;
  userId: string;
  isLive: boolean;
  active: boolean;
  avatarUrl?: string;
}

/** Zrzut danych na żywo zapisywany w cache przy każdym cyklu sprawdzania (bez dodatkowych zapytań do Twitcha). */
export interface LiveSnapshot {
  title?: string;
  game?: string;
  viewerCount?: number;
  liveSince?: Date;
  thumbnailUrl?: string;
}

export interface StreamTemplateVars {
  streamer: string;
  gra: string;
  tytul: string;
  link: string;
}

/** Podstawia zmienne {streamer}/{gra}/{tytuł}/{link} w treści powiadomienia skonfigurowanej przez admina. */
export function renderStreamMessageTemplate(template: string, vars: StreamTemplateVars): string {
  return template
    .replace(/\{streamer\}/g, vars.streamer)
    .replace(/\{gra\}/g, vars.gra)
    .replace(/\{tytuł\}/g, vars.tytul)
    .replace(/\{link\}/g, vars.link);
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
 * Validates that the Twitch channel exists before saving.
 */
export async function addStreamer(
  guildId: string,
  userId: string,
  twitchChannel: string,
): Promise<ServiceResult<TwitchStreamerData>> {
  // Validate Twitch user exists
  const twitchUser = await validateTwitchUser(twitchChannel);
  if (twitchUser === null) {
    return fail('TWITCH_USER_NOT_FOUND', `Użytkownik Twitch „${twitchChannel}" nie istnieje.`);
  }

  // Use the canonical login name from Twitch
  const canonicalChannel = twitchUser.login;

  const existing = await TwitchStreamerModel.findOne({
    guildId,
    twitchChannel: canonicalChannel,
  });
  if (existing) {
    return fail('ALREADY_EXISTS', 'Ten streamer jest już na liście.');
  }

  const doc = await TwitchStreamerModel.create({
    guildId,
    userId,
    twitchChannel: canonicalChannel,
    isLive: false,
    active: true,
    avatarUrl: twitchUser.profilePictureUrl,
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
 * Mark a streamer as live or offline. When going live, `snapshot` persists the
 * already-fetched Twitch stream data (title/game/viewers/thumbnail) so the dashboard
 * can read it straight from Mongo instead of calling Twitch API itself. Going offline
 * clears the snapshot fields.
 */
export async function setLiveStatus(
  guildId: string,
  twitchChannel: string,
  isLive: boolean,
  snapshot?: LiveSnapshot,
): Promise<ServiceResult<void>> {
  const setFields: Record<string, unknown> = { isLive };
  const unsetFields: Record<string, ''> = {};

  if (isLive && snapshot) {
    if (snapshot.title !== undefined) setFields.title = snapshot.title;
    if (snapshot.game !== undefined) setFields.game = snapshot.game;
    if (snapshot.viewerCount !== undefined) setFields.viewerCount = snapshot.viewerCount;
    if (snapshot.liveSince !== undefined) setFields.liveSince = snapshot.liveSince;
    if (snapshot.thumbnailUrl !== undefined) setFields.thumbnailUrl = snapshot.thumbnailUrl;
  } else if (!isLive) {
    unsetFields.title = '';
    unsetFields.game = '';
    unsetFields.viewerCount = '';
    unsetFields.liveSince = '';
    unsetFields.thumbnailUrl = '';
  }

  const update: Record<string, unknown> = { $set: setFields };
  if (Object.keys(unsetFields).length > 0) update.$unset = unsetFields;

  const doc = await TwitchStreamerModel.findOneAndUpdate(
    { guildId, twitchChannel: twitchChannel.toLowerCase() },
    update,
    { new: true },
  );
  if (!doc) return fail('NOT_FOUND', 'Nie znaleziono streamera.');
  return ok(undefined);
}

/** Zapisuje wpis w logu wysłanych powiadomień — zasila licznik "powiadomień w tym miesiącu" na dashboardzie. */
export async function logNotificationSent(guildId: string, twitchChannel: string): Promise<void> {
  await StreamNotificationLogModel.create({ guildId, twitchChannel, sentAt: new Date() });
}

/** Odświeża zapisany avatarUrl streamera — wywoływane z cyklu sprawdzania (już i tak pobiera dane
 * użytkownika z Twitcha), więc nie generuje żadnych dodatkowych zapytań do API. */
export async function updateAvatarUrl(
  guildId: string,
  twitchChannel: string,
  avatarUrl: string,
): Promise<void> {
  await TwitchStreamerModel.updateOne(
    { guildId, twitchChannel: twitchChannel.toLowerCase() },
    { $set: { avatarUrl } },
  );
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
    avatarUrl: doc.avatarUrl,
  };
}
