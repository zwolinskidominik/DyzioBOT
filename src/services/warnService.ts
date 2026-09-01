import { WarnModel, WarnDocument } from '../models/Warn';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import { formatDurationPl } from '../utils/moderationHelpers';
import logger from '../utils/logger';

/* ── Types (drabinka ostrzeżeń — konfigurowalna per-serwer przez ModerationConfig) ── */

export type WarnActionKind = 'none' | 'mute' | 'kick' | 'ban';

export interface WarnStep {
  action: WarnActionKind;
  /** Ma znaczenie tylko gdy action === 'mute'. */
  durationMinutes: number;
}

export interface ResolvedWarnStep extends WarnStep {
  /** ms — 0 dla akcji innych niż 'mute'. */
  durationMs: number;
  /** Czytelna etykieta po polsku, np. "15 minut", "Wyrzucenie z serwera". */
  label: string;
}

/** Legacy domyślna drabinka — używana tylko jako fallback, gdy wołający nie ma jeszcze ModerationConfig. */
export const DEFAULT_WARN_STEPS: WarnStep[] = [
  { action: 'mute', durationMinutes: 15 },
  { action: 'mute', durationMinutes: 180 },
  { action: 'mute', durationMinutes: 1440 },
  { action: 'ban', durationMinutes: 0 },
];

export function describeWarnStep(step: WarnStep): ResolvedWarnStep {
  switch (step.action) {
    case 'none':
      return { ...step, durationMs: 0, label: 'Brak dodatkowej kary' };
    case 'mute': {
      const durationMs = Math.max(1, step.durationMinutes) * 60_000;
      return { ...step, durationMs, label: formatDurationPl(durationMs) };
    }
    case 'kick':
      return { ...step, durationMs: 0, label: 'Wyrzucenie z serwera' };
    case 'ban':
      return { ...step, durationMs: 0, label: 'Permanentny ban' };
  }
}

/* ── Result types ────────────────────────────────────────────────── */

export interface AddWarnData {
  /** Total warnings after the new one was added. */
  count: number;
  /** Kara zastosowana dla TEGO ostrzeżenia. */
  step: ResolvedWarnStep;
  /** Kara przy KOLEJNYM ostrzeżeniu (w trybie 'single' — ta sama; drabinka po ostatnim stopniu się nie wydłuża). */
  nextStep: ResolvedWarnStep;
  /** true gdy to ostrzeżenie osiągnęło lub przekroczyło ostatni stopień drabinki — kolejne ostrzeżenia powtórzą tę samą karę. */
  isFinal: boolean;
  /** Stabilne ID nowo dodanego wpisu (Warn.warnings[i]._id) — do ModerationLog i undo z dashboardu. */
  warnEntryId: string;
}

export interface RemoveWarnData {
  remainingCount: number;
  /** _id usuniętego wpisu — do oznaczenia powiązanego ModerationLog jako cofnięty. Puste przy removeWarnById (wołający już zna to ID). */
  removedId?: string;
}

export interface GetWarningsData {
  warnings: {
    id: string;
    reason: string;
    date: Date;
    moderatorId: string;
    moderatorTag?: string;
    moderator?: string;
  }[];
  count: number;
}

export interface CleanExpiredData {
  totalRemoved: number;
  usersAffected: number;
}

/* ── Service functions ───────────────────────────────────────────── */

/**
 * Dodaje ostrzeżenie i wylicza karę wg drabinki `steps` (przekazywanej przez wołającego —
 * zwykle rozwiązanej z ModerationConfig: tryb 'single' → [warnSingle], tryb 'ladder' → warnSteps).
 * Gdy `count` przekracza długość drabinki, kara się NIE wydłuża — powtarza się ostatni stopień
 * (to samo mechanicznie realizuje tryb 'single', gdy `steps` ma jeden element).
 */
export async function addWarn(params: {
  guildId: string;
  userId: string;
  reason: string;
  moderatorId: string;
  moderatorTag: string;
  steps: WarnStep[];
}): Promise<ServiceResult<AddWarnData>> {
  const { guildId, userId, reason, moderatorId, moderatorTag, steps } = params;

  if (!steps.length) {
    return fail('INVALID_CONFIG', 'Brak skonfigurowanej kary za ostrzeżenie.');
  }

  let record = (await WarnModel.findOne({ userId, guildId })) as WarnDocument | null;
  if (!record) {
    record = new WarnModel({ userId, guildId, warnings: [] }) as WarnDocument;
  }

  record.warnings.push({
    reason,
    date: new Date(),
    moderatorId,
    moderatorTag,
  });

  await record.save();

  const count = record.warnings.length;
  const newEntry = record.warnings[record.warnings.length - 1];
  const warnEntryId = String(newEntry._id);

  const idx = Math.min(count - 1, steps.length - 1);
  const nextIdx = Math.min(count, steps.length - 1);
  const isFinal = count >= steps.length;

  return ok({
    count,
    step: describeWarnStep(steps[idx]),
    nextStep: describeWarnStep(steps[nextIdx]),
    isFinal,
    warnEntryId,
  });
}

export async function removeWarn(params: {
  guildId: string;
  userId: string;
  warningIndex: number;
}): Promise<ServiceResult<RemoveWarnData>> {
  const { guildId, userId, warningIndex } = params;

  const record = (await WarnModel.findOne({ userId, guildId }).exec()) as WarnDocument | null;

  if (!record) {
    return fail('NO_WARNINGS', 'Użytkownik nie posiada żadnych ostrzeżeń.');
  }

  if (warningIndex < 1 || warningIndex > record.warnings.length) {
    return fail('INVALID_INDEX', `Nie znaleziono ostrzeżenia o ID: ${warningIndex}.`);
  }

  const [removed] = record.warnings.splice(warningIndex - 1, 1);
  await record.save();

  return ok({ remainingCount: record.warnings.length, removedId: String(removed._id) });
}

/**
 * Jak `removeWarn`, ale po stabilnym `_id` wpisu zamiast pozycji w tablicy — używane przez
 * dashboard (zakładka "Aktywne ostrzeżenia" / undo w "Otrzymane kary"), gdzie pozycja mogłaby
 * się przesunąć między pobraniem listy a kliknięciem usuń.
 */
export async function removeWarnById(params: {
  guildId: string;
  userId: string;
  warnEntryId: string;
}): Promise<ServiceResult<RemoveWarnData>> {
  const { guildId, userId, warnEntryId } = params;

  const record = (await WarnModel.findOne({ userId, guildId }).exec()) as WarnDocument | null;
  if (!record) {
    return fail('NO_WARNINGS', 'Użytkownik nie posiada żadnych ostrzeżeń.');
  }

  const before = record.warnings.length;
  record.warnings = record.warnings.filter((w) => String(w._id) !== warnEntryId);
  if (record.warnings.length === before) {
    return fail('INVALID_INDEX', 'Nie znaleziono tego ostrzeżenia.');
  }

  await record.save();
  return ok({ remainingCount: record.warnings.length });
}

export async function getWarnings(params: {
  guildId: string;
  userId: string;
}): Promise<ServiceResult<GetWarningsData>> {
  const { guildId, userId } = params;

  const record = await WarnModel.findOne({ userId, guildId }).lean().exec();

  const warnings = ((record?.warnings ?? []) as unknown as (GetWarningsData['warnings'][number] & { _id: unknown })[]).map(
    (w) => ({
      id: String(w._id),
      reason: w.reason,
      date: w.date,
      moderatorId: w.moderatorId,
      moderatorTag: w.moderatorTag,
    })
  );
  return ok({ warnings, count: warnings.length });
}

export async function cleanExpiredWarns(params: {
  /** Gdy pominięte — czyści ostrzeżenia na WSZYSTKICH serwerach (bot jest multi-tenant). */
  guildId?: string;
  monthsAgo?: number;
}): Promise<ServiceResult<CleanExpiredData>> {
  const { guildId, monthsAgo = 3 } = params;

  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setMonth(expiryDate.getMonth() - monthsAgo);

  const records = (await WarnModel.find(guildId ? { guildId } : {}).exec()) as WarnDocument[];

  let totalRemoved = 0;
  let usersAffected = 0;

  for (const record of records) {
    const before = record.warnings.length;
    record.warnings = record.warnings.filter((w) => w.date > expiryDate);
    const removed = before - record.warnings.length;

    if (removed > 0) {
      try {
        await record.save();
        totalRemoved += removed;
        usersAffected++;
        logger.info(
          `🍂 Wygasły ${removed} ostrzeżeń dla userId=${record.userId}, pozostało ${record.warnings.length}`
        );
      } catch (saveError) {
        logger.error(`Błąd zapisu dla userId=${record.userId}: ${saveError}`, saveError);
        if (saveError instanceof Error && saveError.message.includes('validation failed')) {
          await WarnModel.deleteOne({ _id: record._id });
          logger.warn(`Usunięto uszkodzony dokument ostrzeżeń dla userId=${record.userId}`);
        }
      }
    }
  }

  return ok({ totalRemoved, usersAffected });
}
