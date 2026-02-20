import { ServiceResult, ok, fail } from '../types/serviceResult';
import { TicketConfigModel } from '../models/TicketConfig';
import { TicketStateModel } from '../models/TicketState';
import { TicketStatsModel } from '../models/TicketStats';
import { COLORS } from '../config/constants/colors';

/* ── Types ────────────────────────────────────────────────── */

export interface TicketTypeInfo {
  title: string;
  channelPrefix: string;
  color: string;
  image: string;
}

export interface ValidateTicketData {
  categoryId: string;
  ticketType: TicketTypeInfo;
  channelName: string;
}

export interface TakeTicketData {
  assignedTo: string;
  statsCount: number;
}

export interface TicketStateData {
  channelId: string;
  assignedTo: string | null;
}

/* ── Pure data ────────────────────────────────────────────── */

export const TICKET_TYPES: Record<string, TicketTypeInfo> = {
  help: {
    title: 'Dział pomocy',
    channelPrefix: 'pomoc',
    color: COLORS.TICKET,
    image: 'ticketBanner.png',
  },
  report: {
    title: 'System zgłoszeń',
    channelPrefix: 'zgloszenie',
    color: COLORS.TICKET_REPORT,
    image: 'ticketReport.png',
  },
  partnership: {
    title: 'Dział partnerstw',
    channelPrefix: 'partnerstwo',
    color: COLORS.TICKET_PARTNERSHIP,
    image: 'ticketPartnership.png',
  },
  idea: {
    title: 'Pomysły',
    channelPrefix: 'pomysl',
    color: COLORS.TICKET_IDEA,
    image: 'ticketIdea.png',
  },
  rewards: {
    title: 'Odbiór nagród',
    channelPrefix: 'nagrody',
    color: COLORS.TICKET_REWARD,
    image: 'ticketBanner.png',
  },
};

/* ── Service functions ────────────────────────────────────── */

/**
 * Validate prerequisites for ticket creation.
 * Returns category ID, type metadata, and channel name to create.
 */
export async function validateTicketCreation(
  guildId: string,
  ticketType: string,
  username: string,
): Promise<ServiceResult<ValidateTicketData>> {
  const config = await TicketConfigModel.findOne({ guildId });
  if (!config) {
    return fail(
      'NO_CONFIG',
      'Brak konfiguracji systemu ticketów. Użyj komendy `/setup-ticket`, aby ją skonfigurować.',
    );
  }

  const typeInfo = TICKET_TYPES[ticketType];
  if (!typeInfo) {
    return fail('INVALID_TYPE', 'Nieznany rodzaj ticketa.');
  }

  const channelName = `${typeInfo.channelPrefix}-${username.toLowerCase()}`;

  return ok({ categoryId: config.categoryId, ticketType: typeInfo, channelName });
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
  });
}
