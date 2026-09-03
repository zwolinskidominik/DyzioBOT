import mongoose from 'mongoose';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import { TicketConfigModel } from '../models/TicketConfig';
import { TicketStateModel } from '../models/TicketState';
import { TicketStatsModel } from '../models/TicketStats';
import { ITicketType } from '../interfaces/Models';

/* ── Types ────────────────────────────────────────────────── */

export interface ValidateTicketData {
  categoryId: string;
  ticketType: ITicketType;
  channelName: string;
}

export interface TakeTicketData {
  assignedTo: string;
  statsCount: number;
}

export interface TicketStateData {
  channelId: string;
  assignedTo: string | null;
  typeId: string | null;
  creatorId: string | null;
}

/* ── Helpers ──────────────────────────────────────────────── */

const DIACRITICS_PATTERN = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

// Polish letters that don't canonically decompose under NFD (ł/Ł has no combining form).
const NON_DECOMPOSING_MAP: Record<string, string> = { ł: 'l', Ł: 'L' };

/** Turn a user-defined ticket type name into a safe channel-name prefix. */
export function slugifyChannelPrefix(name: string): string {
  const slug = name
    .replace(/[łŁ]/g, (ch) => NON_DECOMPOSING_MAP[ch] ?? ch)
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'ticket';
}

function toPlainTicketType(type: {
  id: string;
  emoji: string;
  name: string;
  description: string;
  roleIds: string[];
  color?: string;
  banner: { mode: 'preset' | 'text' | 'none'; presetId?: string; text?: string };
  thumbnail?: string;
  dropdownDescription?: string;
}): ITicketType {
  const banner: ITicketType['banner'] = { mode: type.banner?.mode ?? 'preset' };
  if (type.banner?.presetId) banner.presetId = type.banner.presetId;
  if (type.banner?.text) banner.text = type.banner.text;

  return {
    id: type.id,
    emoji: type.emoji,
    name: type.name,
    description: type.description ?? '',
    roleIds: [...(type.roleIds ?? [])],
    color: type.color || '#5865F2',
    banner,
    ...(type.thumbnail ? { thumbnail: type.thumbnail } : {}),
    dropdownDescription: type.dropdownDescription ?? '',
  };
}

/* ── Service functions ────────────────────────────────────── */

/**
 * Read the configured, user-defined ticket types for a guild (used to build
 * the select-menu placeholder / re-hydrate live state).
 */
export async function getTicketTypes(guildId: string): Promise<ServiceResult<ITicketType[]>> {
  const config = await TicketConfigModel.findOne({ guildId });
  if (!config) return ok([]);
  return ok(config.types.map(toPlainTicketType));
}

/**
 * Validate prerequisites for ticket creation, including the per-user open
 * ticket limit (automation.maxOpenPerUser — 0 disables the check).
 * Returns category ID, type metadata, and channel name to create.
 */
export async function validateTicketCreation(
  guildId: string,
  typeId: string,
  userId: string,
  username: string,
): Promise<ServiceResult<ValidateTicketData>> {
  const config = await TicketConfigModel.findOne({ guildId });
  if (!config || !config.categoryId) {
    return fail(
      'NO_CONFIG',
      'Brak konfiguracji systemu ticketów. Skonfiguruj go w panelu administracyjnym.',
    );
  }

  if (!config.enabled) {
    return fail(
      'DISABLED',
      'System ticketów jest obecnie wyłączony na tym serwerze.',
    );
  }

  const typeInfo = config.types.find((t) => t.id === typeId);
  if (!typeInfo) {
    return fail('INVALID_TYPE', 'Nieznany rodzaj ticketa.');
  }

  const maxOpenPerUser = config.automation?.maxOpenPerUser ?? 0;
  if (maxOpenPerUser > 0) {
    const openCount = await TicketStateModel.countDocuments({ guildId, creatorId: userId });
    if (openCount >= maxOpenPerUser) {
      return fail(
        'LIMIT_REACHED',
        `Masz już otwarte ${openCount} ${openCount === 1 ? 'zgłoszenie' : 'zgłoszenia'} na tym serwerze — zamknij je, zanim utworzysz kolejne (limit: ${maxOpenPerUser}).`,
      );
    }
  }

  const ticketType = toPlainTicketType(typeInfo);
  const channelName = `${slugifyChannelPrefix(ticketType.name)}-${username.toLowerCase()}`;

  return ok({ categoryId: config.categoryId, ticketType, channelName });
}

/**
 * Assign a moderator to a ticket. Creates TicketState (upsert) and
 * increments the moderator's TicketStats.
 */
export async function takeTicket(
  channelId: string,
  guildId: string,
  moderatorId: string,
): Promise<ServiceResult<TakeTicketData>> {
  const existing = await TicketStateModel.findOne({ channelId });
  if (existing?.assignedTo) {
    return fail('ALREADY_TAKEN', 'To zgłoszenie zostało już zajęte!');
  }

  await TicketStateModel.findOneAndUpdate(
    { channelId },
    { assignedTo: moderatorId },
    { upsert: true, new: true },
  );

  const stats = await TicketStatsModel.findOneAndUpdate(
    { guildId, userId: moderatorId },
    { $inc: { count: 1 } },
    { upsert: true, new: true },
  );

  return ok({ assignedTo: moderatorId, statsCount: stats.count });
}

/**
 * Persist which guild/type/creator a newly-opened ticket channel belongs to,
 * so later staff-permission checks (take/close) and the auto-close scheduler
 * know which roleIds apply and how long the channel has been idle.
 */
export async function registerTicketChannel(
  channelId: string,
  guildId: string,
  typeId: string,
  creatorId: string,
): Promise<ServiceResult<void>> {
  await TicketStateModel.findOneAndUpdate(
    { channelId },
    { guildId, typeId, creatorId, lastActivityAt: new Date() },
    { upsert: true, new: true },
  );
  return ok(undefined);
}

/**
 * Bump a ticket channel's last-activity timestamp (called on every non-bot
 * message in the channel). No-ops silently for non-ticket channels.
 */
export async function touchTicketActivity(channelId: string): Promise<void> {
  await TicketStateModel.findOneAndUpdate({ channelId }, { lastActivityAt: new Date() });
}

/**
 * Remove the ticket state record for a channel (cleanup on close).
 */
export async function closeTicket(channelId: string): Promise<ServiceResult<void>> {
  await TicketStateModel.findOneAndDelete({ channelId });
  return ok(undefined);
}

/**
 * Read the current ticket state for a channel.
 */
export async function getTicketState(
  channelId: string,
): Promise<ServiceResult<TicketStateData>> {
  const state = await TicketStateModel.findOne({ channelId });
  return ok({
    channelId,
    assignedTo: state?.assignedTo ?? null,
    typeId: state?.typeId ?? null,
    creatorId: state?.creatorId ?? null,
  });
}

/**
 * Resolve the roleIds allowed to manage (take/close) a given ticket channel,
 * based on the type it was created under. Empty array if unknown.
 */
export async function getStaffRoleIdsForChannel(
  guildId: string,
  channelId: string,
): Promise<string[]> {
  const state = await TicketStateModel.findOne({ channelId });
  if (!state?.typeId) return [];

  const config = await TicketConfigModel.findOne({ guildId });
  const type = config?.types.find((t) => t.id === state.typeId);
  return type ? [...type.roleIds] : [];
}

/**
 * Guilds with auto-close enabled (automation.autoCloseHours > 0), paired with
 * the channelIds of their tickets that have been idle past the threshold.
 * Used by the auto-close scheduler.
 */
export interface IdleTicketGroup {
  guildId: string;
  autoCloseHours: number;
  channelIds: string[];
}

export async function findIdleTicketGroups(): Promise<IdleTicketGroup[]> {
  // mongoose.trusted(): sanitizeFilter (index.ts) sanityzuje ręcznie pisane
  // operatory — bez tego auto-close ticketów rzuca CastError.
  const configs = await TicketConfigModel.find({ 'automation.autoCloseHours': mongoose.trusted({ $gt: 0 }) });
  const groups: IdleTicketGroup[] = [];

  for (const config of configs) {
    const autoCloseHours = config.automation.autoCloseHours;
    const cutoff = new Date(Date.now() - autoCloseHours * 60 * 60 * 1000);
    const idleStates = await TicketStateModel.find({
      guildId: config.guildId,
      lastActivityAt: mongoose.trusted({ $lt: cutoff }),
    });

    if (idleStates.length > 0) {
      groups.push({
        guildId: config.guildId,
        autoCloseHours,
        channelIds: idleStates.map((s) => s.channelId),
      });
    }
  }

  return groups;
}

/**
 * Read a guild's transcript settings (enabled + destination channel).
 * Returns null when transcripts are disabled or no destination is set.
 */
export async function getTranscriptDestination(
  guildId: string,
): Promise<{ transcriptChannelId: string } | null> {
  const config = await TicketConfigModel.findOne({ guildId });
  if (!config?.automation?.transcriptEnabled || !config.automation.transcriptChannelId) return null;
  return { transcriptChannelId: config.automation.transcriptChannelId };
}
