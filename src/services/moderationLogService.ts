import { ModerationLogModel, ModerationLogKind } from '../models/ModerationLog';
import logger from '../utils/logger';

export interface LogModerationActionParams {
  guildId: string;
  kind: ModerationLogKind;
  /** ID użytkownika (ban/kick/mute/warn) lub nazwa kanału bez '#' (clear). */
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason?: string;
  extra?: string;
  /** Tylko dla kind === 'warn' — _id konkretnego wpisu w Warn.warnings, do undo z dashboardu. */
  warnEntryId?: string;
}

/**
 * Zapisuje wpis do historii kar (zakładka "Otrzymane kary" w dashboardzie).
 * Nigdy nie rzuca — logowanie nie może wywrócić samej akcji moderacyjnej,
 * która już się wykonała po stronie Discorda.
 */
export async function logModerationAction(params: LogModerationActionParams): Promise<void> {
  try {
    await ModerationLogModel.create({
      guildId: params.guildId,
      kind: params.kind,
      targetId: params.targetId,
      targetTag: params.targetTag,
      moderatorId: params.moderatorId,
      moderatorTag: params.moderatorTag,
      reason: params.reason ?? '',
      extra: params.extra,
      warnEntryId: params.warnEntryId,
    });
  } catch (error) {
    logger.error(`Błąd zapisu ModerationLog (${params.kind}, guild=${params.guildId}): ${error}`);
  }
}

/** Oznacza wszystkie aktywne wpisy 'ban' danego użytkownika jako cofnięte — wołane przez /unban. */
export async function markBanLogUndone(guildId: string, targetId: string): Promise<void> {
  try {
    await ModerationLogModel.updateMany(
      { guildId, kind: 'ban', targetId, undone: false },
      { $set: { undone: true } }
    );
  } catch (error) {
    logger.error(`Błąd oznaczania ModerationLog jako cofnięty (ban, guild=${guildId}): ${error}`);
  }
}

/**
 * Oznacza wpis 'warn' powiązany z konkretnym wpisem Warn.warnings[]._id jako cofnięty —
 * wołane przez /warn-remove (i dashboard, przy usuwaniu ostrzeżenia z listy aktywnych).
 */
export async function markWarnLogUndone(guildId: string, warnEntryId: string): Promise<void> {
  try {
    await ModerationLogModel.updateMany(
      { guildId, kind: 'warn', warnEntryId, undone: false },
      { $set: { undone: true } }
    );
  } catch (error) {
    logger.error(`Błąd oznaczania ModerationLog jako cofnięty (warn, guild=${guildId}): ${error}`);
  }
}
