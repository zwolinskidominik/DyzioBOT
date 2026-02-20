import { WarnModel, WarnDocument } from '../models/Warn';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

/* ── Constants (business rules) ──────────────────────────────────── */

export const WARN_LIMIT = 4;

export interface WarnPunishment {
  duration: number;
  label: string;
}

export const WARN_PUNISHMENTS: Record<number, WarnPunishment> = {
  1: { duration: 15 * 60 * 1000, label: '15 minut' },
  2: { duration: 3 * 60 * 60 * 1000, label: '3 godziny' },
  3: { duration: 24 * 60 * 60 * 1000, label: '1 dzień' },
  4: { duration: 0, label: 'BAN' },
};

/* ── Result types ────────────────────────────────────────────────── */

export interface AddWarnData {
  /** Total warnings after the new one was added. */
  count: number;
  /** True when count >= WARN_LIMIT → caller should ban. */
  shouldBan: boolean;
  /** Timeout punishment for the current warn level (null when ban). */
  punishment: WarnPunishment | null;
  /** Punishment the user will get if they receive one more warn. */
  nextPunishment: WarnPunishment | null;
}

export interface RemoveWarnData {
  remainingCount: number;
}

export interface GetWarningsData {
  warnings: {
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

export async function addWarn(params: {
  guildId: string;
  userId: string;
  reason: string;
  moderatorId: string;
  moderatorTag: string;
}): Promise<ServiceResult<AddWarnData>> {
  const { guildId, userId, reason, moderatorId, moderatorTag } = params;

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
  const shouldBan = count >= WARN_LIMIT;
  const punishment = WARN_PUNISHMENTS[count] ?? null;
  const nextPunishment = WARN_PUNISHMENTS[count + 1] ?? null;

  return ok({ count, shouldBan, punishment, nextPunishment });
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

  record.warnings.splice(warningIndex - 1, 1);
  await record.save();

  return ok({ remainingCount: record.warnings.length });
}

export async function getWarnings(params: {
  guildId: string;
  userId: string;
}): Promise<ServiceResult<GetWarningsData>> {
  const { guildId, userId } = params;

  const record = await WarnModel.findOne({ userId, guildId }).lean().exec();

  const warnings = (record?.warnings as GetWarningsData['warnings']) ?? [];
  return ok({ warnings, count: warnings.length });
}

export async function cleanExpiredWarns(params: {
  guildId: string;
  monthsAgo?: number;
}): Promise<ServiceResult<CleanExpiredData>> {
  const { guildId, monthsAgo = 3 } = params;

  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setMonth(expiryDate.getMonth() - monthsAgo);

  const records = (await WarnModel.find({ guildId }).exec()) as WarnDocument[];

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
