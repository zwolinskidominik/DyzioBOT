import { GiveawayModel } from '../models/Giveaway';
import { GiveawayConfigModel } from '../models/GiveawayConfig';
import type { IGiveaway } from '../interfaces/Models';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import { randomUUID } from 'crypto';
import { parseRawDurationMs } from '../utils/parseDuration';

export { parseRawDurationMs as parseDuration };

/* ── Types ────────────────────────────────────────────────────── */

export interface CreateGiveawayInput {
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  description: string;
  winnersCount: number;
  durationMs: number;
  hostId: string;
  pingRoleId?: string;
  roleMultipliers?: Record<string, number>;
}

export interface GiveawayData {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  description: string;
  winnersCount: number;
  endTime: Date;
  hostId: string;
  pingRoleId?: string;
  active: boolean;
  participants: string[];
  roleMultipliers?: Record<string, number>;
  finalized: boolean;
}

export interface EditGiveawayInput {
  prize?: string;
  description?: string;
  winnersCount?: number;
  durationMs?: number;
  pingRoleId?: string;
}

export interface DeleteResult {
  messageId: string;
  channelId: string;
}

export interface EndResult {
  giveaway: GiveawayData;
  winnerIds: string[];
}

export interface JoinResult {
  multiplier: number;
  totalParticipants: number;
}

export interface LeaveResult {
  totalParticipants: number;
}

export interface RerollResult {
  giveaway: GiveawayData;
  winnerIds: string[];
}

export interface ListEntry {
  giveawayId: string;
  prize: string;
  winnersCount: number;
  endTime: Date;
  participantsCount: number;
}

export interface FinalizedEntry {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  description: string;
  hostId: string;
  participants: string[];
  winnersCount: number;
  endTime: Date;
  winnerIds: string[];
}

/* ── Pure helpers ─────────────────────────────────────────────── */

/**
 * Get an active giveaway by ID and guild.
 */
export async function getActiveGiveaway(
  giveawayId: string,
  guildId: string,
): Promise<ServiceResult<GiveawayData>> {
  const doc = await GiveawayModel.findOne({ giveawayId, guildId }).lean();
  if (!doc) return fail('NOT_FOUND', 'Ten giveaway nie został znaleziony lub został już zakończony.');
  if (!doc.active) return fail('NOT_ACTIVE', 'Ten giveaway został już zakończony.');
  return ok(toGiveawayData(doc));
}

/**
 * Get a giveaway by ID and guild (regardless of active state).
 */
export async function getGiveaway(
  giveawayId: string,
  guildId: string,
): Promise<ServiceResult<GiveawayData>> {
  const doc = await GiveawayModel.findOne({ giveawayId, guildId }).lean();
  if (!doc) return fail('NOT_FOUND', 'Giveaway nie został znaleziony.');
  return ok(toGiveawayData(doc));
}

/**
 * Draw unique winner IDs from a participants pool (may contain duplicates for multiplied entries).
 * Returns up to `count` unique user IDs, shuffled randomly.
 */
export function pickWinnerIds(participants: string[], count: number): string[] {
  if (!participants.length || count < 1) return [];

  // Shuffle using Fisher-Yates (partial)
  const pool = [...participants];
  const maxShuffle = Math.min(pool.length, count * 5);
  for (let i = 0; i < maxShuffle; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const winners: string[] = [];
  const seen = new Set<string>();
  for (const id of pool) {
    if (seen.has(id)) continue;
    seen.add(id);
    winners.push(id);
    if (winners.length === count) break;
  }
  return winners;
}

/**
 * Compute the effective multiplier for a user given their role IDs
 * and merged role multipliers from config + per-giveaway overrides.
 */
export function computeMultiplier(
  memberRoleIds: string[],
  roleMultipliers: Record<string, number>,
): number {
  let best = 1;
  for (const roleId of memberRoleIds) {
    const m = roleMultipliers[roleId];
    if (m && m > best) best = m;
  }
  return best;
}

/* ── DB helpers ───────────────────────────────────────────────── */

async function getMergedMultipliers(
  guildId: string,
  perGiveaway?: Map<string, number> | Record<string, number>,
): Promise<Record<string, number>> {
  const merged: Record<string, number> = {};

  try {
    const config = await GiveawayConfigModel.findOne({ guildId });
    if (config?.enabled && config.roleMultipliers?.length > 0) {
      for (const rm of config.roleMultipliers) {
        merged[rm.roleId] = rm.multiplier;
      }
    }
  } catch {
    /* ignore config errors */
  }

  if (perGiveaway) {
    const entries =
      perGiveaway instanceof Map
        ? perGiveaway.entries()
        : Object.entries(perGiveaway);
    for (const [roleId, mult] of entries) {
      merged[roleId] = mult;
    }
  }

  return merged;
}

export async function getAdditionalNote(guildId: string): Promise<string> {
  try {
    const config = await GiveawayConfigModel.findOne({ guildId });
    if (config?.enabled && config.additionalNote) {
      return `\n\n${config.additionalNote}`;
    }
  } catch {
    /* ignore */
  }
  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGiveawayData(doc: any): GiveawayData {
  const raw = doc as Record<string, unknown>;
  const rm = raw.roleMultipliers;
  let roleMultipliers: Record<string, number> | undefined;
  if (rm instanceof Map) {
    roleMultipliers = Object.fromEntries(rm);
  } else if (rm && typeof rm === 'object') {
    roleMultipliers = rm as Record<string, number>;
  }

  return {
    giveawayId: doc.giveawayId as string,
    guildId: doc.guildId as string,
    channelId: doc.channelId as string,
    messageId: doc.messageId as string,
    prize: doc.prize as string,
    description: doc.description as string,
    winnersCount: doc.winnersCount as number,
    endTime: doc.endTime as Date,
    hostId: doc.hostId as string,
    pingRoleId: doc.pingRoleId as string | undefined,
    active: doc.active as boolean,
    participants: doc.participants as string[],
    roleMultipliers,
    finalized: doc.finalized as boolean,
  };
}

/* ── Service API ──────────────────────────────────────────────── */

export async function createGiveaway(
  input: CreateGiveawayInput,
): Promise<ServiceResult<GiveawayData>> {
  const { durationMs, ...rest } = input;

  if (isNaN(durationMs) || durationMs <= 0) {
    return fail('INVALID_DURATION', 'Czas trwania musi być większy niż 0');
  }

  const giveawayId = randomUUID();
  const endTime = new Date(Date.now() + durationMs);

  const data: IGiveaway = {
    ...rest,
    giveawayId,
    endTime,
    active: true,
    participants: [],
    createdAt: new Date(),
    finalized: false,
  };

  await GiveawayModel.create(data);
  return ok(toGiveawayData(data));
}

export async function editGiveaway(
  giveawayId: string,
  guildId: string,
  changes: EditGiveawayInput,
): Promise<ServiceResult<GiveawayData>> {
  if (!changes.prize && !changes.description && !changes.winnersCount && !changes.durationMs && !changes.pingRoleId) {
    return fail('NO_CHANGES', 'Nie podano żadnych wartości do edycji');
  }

  const giveaway = await GiveawayModel.findOne({ giveawayId, guildId }).exec();
  if (!giveaway) return fail('NOT_FOUND', 'Giveaway nie został znaleziony');

  if (changes.prize) giveaway.prize = changes.prize;
  if (changes.description) giveaway.description = changes.description;
  if (changes.winnersCount) giveaway.winnersCount = changes.winnersCount;
  if (changes.durationMs) {
    if (changes.durationMs <= 0) {
      return fail('INVALID_DURATION', 'Czas trwania musi być większy niż 0');
    }
    giveaway.endTime = new Date(Date.now() + changes.durationMs);
  }
  if (changes.pingRoleId) giveaway.pingRoleId = changes.pingRoleId;

  await giveaway.save();
  return ok(toGiveawayData(giveaway.toObject()));
}

export async function deleteGiveaway(
  giveawayId: string,
  guildId: string,
): Promise<ServiceResult<DeleteResult>> {
  const giveaway = await GiveawayModel.findOne({ giveawayId, guildId }).lean<IGiveaway>().exec();
  if (!giveaway) return fail('NOT_FOUND', 'Giveaway nie został znaleziony');

  await GiveawayModel.deleteOne({ giveawayId, guildId });
  return ok({ messageId: giveaway.messageId, channelId: giveaway.channelId });
}

export async function endGiveaway(
  giveawayId: string,
  guildId: string,
): Promise<ServiceResult<EndResult>> {
  const giveaway = await GiveawayModel.findOne({ giveawayId, guildId }).exec();
  if (!giveaway) return fail('NOT_FOUND', 'Giveaway nie został znaleziony');
  if (!giveaway.active) return fail('ALREADY_ENDED', 'Ten giveaway został już zakończony');

  giveaway.active = false;
  giveaway.finalized = true;
  await giveaway.save();

  const winnerIds = pickWinnerIds(giveaway.participants, giveaway.winnersCount);
  return ok({ giveaway: toGiveawayData(giveaway.toObject()), winnerIds });
}

export async function joinGiveaway(
  giveawayId: string,
  guildId: string,
  userId: string,
  memberRoleIds: string[],
): Promise<ServiceResult<JoinResult>> {
  const giveaway = await GiveawayModel.findOne({ giveawayId, guildId }).exec();
  if (!giveaway) return fail('NOT_FOUND', 'Giveaway nie został znaleziony');
  if (!giveaway.active) return fail('NOT_ACTIVE', 'Ten giveaway został już zakończony');
  if (giveaway.participants.includes(userId)) {
    return fail('ALREADY_JOINED', 'Już dołączyłeś do tego giveawayu');
  }

  const merged = await getMergedMultipliers(
    guildId,
    giveaway.roleMultipliers,
  );
  const multiplier = computeMultiplier(memberRoleIds, merged);

  for (let i = 0; i < multiplier; i++) {
    giveaway.participants.push(userId);
  }
  await giveaway.save();

  return ok({ multiplier, totalParticipants: giveaway.participants.length });
}

export async function leaveGiveaway(
  giveawayId: string,
  guildId: string,
  userId: string,
): Promise<ServiceResult<LeaveResult>> {
  const giveaway = await GiveawayModel.findOne({ giveawayId, guildId }).exec();
  if (!giveaway) return fail('NOT_FOUND', 'Giveaway nie został znaleziony');
  if (!giveaway.participants.includes(userId)) {
    return fail('NOT_JOINED', 'Nie jesteś zapisany do tego giveawayu');
  }

  giveaway.participants = giveaway.participants.filter((id: string) => id !== userId);
  await giveaway.save();

  return ok({ totalParticipants: giveaway.participants.length });
}

export async function rerollGiveaway(
  giveawayId: string,
  guildId: string,
): Promise<ServiceResult<RerollResult>> {
  const giveaway = await GiveawayModel.findOne({ giveawayId, guildId }).lean<IGiveaway>().exec();
  if (!giveaway) return fail('NOT_FOUND', 'Giveaway nie został znaleziony');
  if (giveaway.active) return fail('STILL_ACTIVE', 'Giveaway musi być zakończony, aby móc wykonać reroll');
  if (giveaway.participants.length === 0) return fail('NO_PARTICIPANTS', 'Brak uczestników giveawayu');

  const winnerIds = pickWinnerIds(giveaway.participants, giveaway.winnersCount);
  return ok({ giveaway: toGiveawayData(giveaway), winnerIds });
}

export async function listActiveGiveaways(
  guildId: string,
): Promise<ServiceResult<ListEntry[]>> {
  const giveaways = await GiveawayModel.find({ guildId, active: true }).lean<IGiveaway[]>();

  if (!giveaways || giveaways.length === 0) {
    return fail('NONE', 'Brak aktywnych giveawayów na tym serwerze');
  }

  const sorted = giveaways
    .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())
    .map((g) => ({
      giveawayId: g.giveawayId,
      prize: g.prize,
      winnersCount: g.winnersCount,
      endTime: g.endTime,
      participantsCount: g.participants.length,
    }));

  return ok(sorted);
}

export async function finalizeExpiredGiveaways(): Promise<ServiceResult<FinalizedEntry[]>> {
  const finalized: FinalizedEntry[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = new Date();
    const giveaway = await GiveawayModel.findOneAndUpdate(
      { finalized: false, endTime: { $lte: now } },
      { active: false },
      { returnDocument: 'after', sort: { endTime: 1 } },
    );
    if (!giveaway) break;

    const winnerIds = pickWinnerIds(giveaway.participants, giveaway.winnersCount);

    await GiveawayModel.updateOne(
      { _id: giveaway._id, finalized: false },
      { $set: { finalized: true } },
    );

    finalized.push({
      giveawayId: giveaway.giveawayId,
      guildId: giveaway.guildId,
      channelId: giveaway.channelId,
      messageId: giveaway.messageId,
      prize: giveaway.prize,
      description: giveaway.description,
      hostId: giveaway.hostId,
      participants: giveaway.participants,
      winnersCount: giveaway.winnersCount,
      endTime: giveaway.endTime,
      winnerIds,
    });
  }

  return ok(finalized);
}
