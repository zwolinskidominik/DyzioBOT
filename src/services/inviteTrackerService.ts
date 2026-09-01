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

export interface JoinMessagesData {
  normal: string;
  selfInvite: string;
  unknown: string;
  vanity: string;
  botAdd: string;
}

export interface LeaveMessagesData {
  normal: string;
  unknown: string;
  vanity: string;
  botRemove: string;
}

export interface SectionConfigData<M> {
  enabled: boolean;
  logChannelId: string | null;
  embed: boolean;
  /** Niestandardowy kolor embeda (hex). Puste = użyj domyślnego koloru sytuacji. */
  embedColor: string;
  messages: M;
}

export interface InviteTrackerConfigData {
  enabled: boolean;
  join: SectionConfigData<JoinMessagesData>;
  leave: SectionConfigData<LeaveMessagesData>;
}

export type JoinSituation = 'normal' | 'selfInvite' | 'unknown' | 'vanity' | 'botAdd';
export type LeaveSituation = 'normal' | 'unknown' | 'vanity' | 'botRemove';

export interface SituationMeta {
  id: string;
  label: string;
  hint: string;
  accent: string;
  embedTitle: string;
  defaultTemplate: string;
}

/* ── Sytuacje: kolory/tytuły embeda i treści domyślne — 1:1 z prototypu ── */

export const JOIN_SITUATIONS: Record<JoinSituation, SituationMeta> = {
  normal: {
    id: 'normal',
    label: 'Normalne dołączenie',
    hint: 'Kiedy użytkownik jest zaproszony przez kogoś innego.',
    accent: '#22c55e',
    embedTitle: '🎉 Nowy członek',
    defaultTemplate: '**{memberMention}** został zaproszony przez **{inviterName}**, który/a ma teraz **{inviteCount} zaproszeń**!',
  },
  selfInvite: {
    id: 'selfInvite',
    label: 'Sam się zaprosił',
    hint: 'Kiedy użytkownik sam się zaprosił na Twój serwer.',
    accent: '#38bdf8',
    embedTitle: '🔗 Samo-zaproszenie',
    defaultTemplate: '**{memberName}** zaprosił się sam.',
  },
  unknown: {
    id: 'unknown',
    label: 'Nieznany autor zaproszenia',
    hint: 'Kiedy użytkownik dołącza, ale nie da się ustalić, kto go zaprosił.',
    accent: '#f59e0b',
    embedTitle: '❓ Nieznane źródło',
    defaultTemplate: 'Nie jestem w stanie powiedzieć, kto zaprosił **{memberName}**. Możliwe, że to zaproszenie tymczasowe.',
  },
  vanity: {
    id: 'vanity',
    label: 'Niestandardowe zaproszenie',
    hint: 'Gdy użytkownik jest zaproszony za pomocą zaproszenia niestandardowego.',
    accent: '#a970ff',
    embedTitle: '✨ Niestandardowe zaproszenie',
    defaultTemplate: '**{memberName}** dołączył używając niestandardowego zaproszenia **{inviteCode}**.',
  },
  botAdd: {
    id: 'botAdd',
    label: 'Dodanie bota',
    hint: 'Kiedy ktoś dodaje bota na serwer.',
    accent: '#5865F2',
    embedTitle: '🤖 Dodano bota',
    defaultTemplate: '**{memberMention}** 🤖 został właśnie dodany na ten serwer przez **{inviterName}**',
  },
};

export const LEAVE_SITUATIONS: Record<LeaveSituation, SituationMeta> = {
  normal: {
    id: 'normal',
    label: 'Normalne opuszczenie',
    hint: 'Kiedy użytkownik opuścił serwer i był zaproszony przez kogoś innego.',
    accent: '#ef4444',
    embedTitle: '😢 Ktoś nas opuścił',
    defaultTemplate: '**{memberName}** opuścił serwer. Zaprosił go **{inviterName}**.',
  },
  unknown: {
    id: 'unknown',
    label: 'Nieznany autor zaproszenia',
    hint: 'Kiedy użytkownik opuścił serwer, a nie wiadomo, kto go zaprosił.',
    accent: '#f59e0b',
    embedTitle: '❓ Odszedł — nieznane źródło',
    defaultTemplate: '**{memberName}** opuścił serwer, ale nie wiem, kto go zaprosił.',
  },
  vanity: {
    id: 'vanity',
    label: 'Niestandardowe zaproszenie',
    hint: 'Kiedy użytkownik wszedł przez zaproszenie niestandardowe i opuścił serwer.',
    accent: '#a970ff',
    embedTitle: '✨ Odszedł — niestandardowe',
    defaultTemplate: '**{memberName}** opuścił serwer. Dołączył używając niestandardowego zaproszenia **{inviteCode}**.',
  },
  botRemove: {
    id: 'botRemove',
    label: 'Usunięcie bota',
    hint: 'Kiedy ktoś usuwa bota z serwera.',
    accent: '#5865F2',
    embedTitle: '🤖 Usunięto bota',
    defaultTemplate: '**{memberName}** 🤖 został usunięty z serwera.',
  },
};

/* ── Zmienne szablonu ────────────────────────────────────────────── */

export interface MessageContext {
  memberMention: string;
  memberName: string;
  inviterName: string;
  inviteCount: string;
  inviteCode: string;
}

/**
 * Podstawia zmienne w szablonie. Wspiera nowe nazwy ({memberMention} itd.) oraz —
 * dla kompatybilności wstecznej z szablonami zapisanymi przed redesignem —
 * stare nazwy ({user}, {username}, {inviter}, {activeCount}).
 */
export function replaceVariables(template: string, ctx: MessageContext): string {
  return template
    .replace(/\{memberMention\}/g, ctx.memberMention)
    .replace(/\{memberName\}/g, ctx.memberName)
    .replace(/\{inviterName\}/g, ctx.inviterName)
    .replace(/\{inviteCount\}/g, ctx.inviteCount)
    .replace(/\{inviteCode\}/g, ctx.inviteCode)
    .replace(/\{user\}/g, ctx.memberMention)
    .replace(/\{username\}/g, ctx.memberName)
    .replace(/\{inviter\}/g, ctx.inviterName)
    .replace(/\{activeCount\}/g, ctx.inviteCount);
}

export interface ResolvedMessage {
  text: string;
  embed?: { color: string; title: string };
}

/** Wybiera treść (custom albo domyślną dla danej sytuacji), podstawia zmienne, opcjonalnie owija w embed. */
export function buildInviteMessage(
  customTemplate: string,
  situation: SituationMeta,
  ctx: MessageContext,
  useEmbed: boolean,
  embedColor?: string,
): ResolvedMessage {
  const raw = customTemplate.trim() ? customTemplate : situation.defaultTemplate;
  const text = replaceVariables(raw, ctx);
  return useEmbed ? { text, embed: { color: embedColor?.trim() || situation.accent, title: situation.embedTitle } } : { text };
}

/* ── Config ──────────────────────────────────────────────────────── */

const EMPTY_JOIN_MESSAGES: JoinMessagesData = { normal: '', selfInvite: '', unknown: '', vanity: '', botAdd: '' };
const EMPTY_LEAVE_MESSAGES: LeaveMessagesData = { normal: '', unknown: '', vanity: '', botRemove: '' };

export async function getConfig(guildId: string): Promise<ServiceResult<InviteTrackerConfigData>> {
  try {
    const doc = await InviteTrackerConfigModel.findOne({ guildId }).lean();
    // `legacy` czyta pola sprzed redesignu (płaski kształt) — dokument może je jeszcze
    // mieć, jeśli migracja (src/scripts/migrateInviteTrackerConfig.ts) nie została uruchomiona.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = doc as any;

    const join: SectionConfigData<JoinMessagesData> = {
      enabled: doc?.join?.enabled ?? true,
      logChannelId: doc?.join?.logChannelId ?? legacy?.logChannelId ?? null,
      embed: doc?.join?.embed ?? false,
      embedColor: doc?.join?.embedColor ?? '',
      messages: {
        normal: doc?.join?.messages?.normal || legacy?.joinMessage || '',
        selfInvite: doc?.join?.messages?.selfInvite || '',
        unknown: doc?.join?.messages?.unknown || legacy?.joinMessageUnknown || '',
        vanity: doc?.join?.messages?.vanity || legacy?.joinMessageVanity || '',
        botAdd: doc?.join?.messages?.botAdd || '',
      },
    };

    const leave: SectionConfigData<LeaveMessagesData> = {
      enabled: doc?.leave?.enabled ?? true,
      logChannelId: doc?.leave?.logChannelId ?? legacy?.logChannelId ?? null,
      embed: doc?.leave?.embed ?? false,
      embedColor: doc?.leave?.embedColor ?? '',
      messages: {
        normal: doc?.leave?.messages?.normal || legacy?.leaveMessage || '',
        unknown: doc?.leave?.messages?.unknown || '',
        vanity: doc?.leave?.messages?.vanity || '',
        botRemove: doc?.leave?.messages?.botRemove || '',
      },
    };

    return ok({
      enabled: doc?.enabled ?? false,
      join: doc?.join ? join : { ...join, messages: { ...EMPTY_JOIN_MESSAGES, ...join.messages } },
      leave: doc?.leave ? leave : { ...leave, messages: { ...EMPTY_LEAVE_MESSAGES, ...leave.messages } },
    });
  } catch (error) {
    logger.error(`[InviteTracker] getConfig error: ${error}`);
    return fail('DB_ERROR', 'Nie udało się pobrać konfiguracji invite trackera.');
  }
}

export interface SectionConfigUpdate<M> {
  enabled?: boolean;
  logChannelId?: string | null;
  embed?: boolean;
  embedColor?: string;
  messages?: Partial<M>;
}

export async function updateConfig(
  guildId: string,
  data: {
    enabled?: boolean;
    join?: SectionConfigUpdate<JoinMessagesData>;
    leave?: SectionConfigUpdate<LeaveMessagesData>;
  },
): Promise<ServiceResult<{ updated: boolean }>> {
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
  inviteCode: string | null;
}>> {
  try {
    // Mark the most recent active entry for this user as left
    const entry = await InviteEntryModel.findOneAndUpdate(
      { guildId, joinedUserId: userId, active: true },
      { active: false, leftAt: new Date() },
      { sort: { joinedAt: -1 }, new: true },
    );

    return ok({ inviterId: entry?.inviterId ?? null, inviteCode: entry?.inviteCode ?? null });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<ServiceResult<{ entries: any[]; totalCount: number }>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
