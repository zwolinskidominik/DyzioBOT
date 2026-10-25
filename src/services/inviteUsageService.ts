import { Collection, Invite } from 'discord.js';
import mongoose from 'mongoose';
import { InviteUsageModel } from '../models/InviteUsage';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

/**
 * Trwała historia liczników zaproszeń (kolekcja inviteusages).
 *
 * Liczba „ma X zaproszeń" to suma użyć WSZYSTKICH zaproszeń danej osoby, jakie bot kiedykolwiek
 * widział - także tych, które już wygasły, zostały usunięte albo zużyły limit. Zaproszenia,
 * które zniknęły, zanim bot zaczął je zapisywać, są nie do odzyskania (Discord ich nie podaje).
 */

function upsertOp(guildId: string, invite: Invite, now: Date) {
  const inviterId = invite.inviter?.id ?? null;
  return {
    updateOne: {
      filter: { guildId, code: invite.code },
      update: {
        // Licznik tylko rośnie - chroni przed cofnięciem przez nieaktualną odpowiedź.
        $max: { uses: invite.uses ?? 0 },
        $set: { deleted: false, lastSeenAt: now, ...(inviterId ? { inviterId } : {}) },
        ...(inviterId ? {} : { $setOnInsert: { inviterId: null } }),
      },
      upsert: true,
    },
  };
}

/** Zapisuje jedno zaproszenie (inviteCreate). */
export async function recordInvite(guildId: string, invite: Invite, now: Date = new Date()): Promise<ServiceResult<void>> {
  try {
    await InviteUsageModel.bulkWrite([upsertOp(guildId, invite, now)]);
    return ok(undefined);
  } catch (err) {
    logger.error(`[InviteUsage] recordInvite failed guild=${guildId}: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się zapisać zaproszenia.');
  }
}

/** Zapisuje aktualną listę zaproszeń gildii; tych, których na niej nie ma, nie kasuje - oznacza jako usunięte. */
export async function syncGuildInvites(
  guildId: string,
  invites: Collection<string, Invite>,
  now: Date = new Date(),
): Promise<ServiceResult<void>> {
  try {
    const ops = [...invites.values()].map((invite) => upsertOp(guildId, invite, now));
    if (ops.length > 0) await InviteUsageModel.bulkWrite(ops, { ordered: false });

    // mongoose.trusted(): sanitizeFilter (src/index.ts) psuje ręcznie pisane operatory.
    // Lista kodów pochodzi z Discorda, nie od użytkownika.
    await InviteUsageModel.updateMany(
      { guildId, deleted: false, code: mongoose.trusted({ $nin: [...invites.keys()] }) },
      { $set: { deleted: true } },
    );
    return ok(undefined);
  } catch (err) {
    logger.error(`[InviteUsage] syncGuildInvites failed guild=${guildId}: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się zapisać liczników zaproszeń.');
  }
}

/**
 * Zaproszenie zużyło limit przy tym dołączeniu i Discord je skasował - zapisujemy ostatni
 * licznik, którego Discord już nie poda.
 */
export async function recordConsumedInvite(
  guildId: string,
  code: string,
  inviterId: string | null,
  uses: number,
): Promise<ServiceResult<void>> {
  try {
    await InviteUsageModel.updateOne(
      { guildId, code },
      {
        $max: { uses },
        $set: { deleted: true, ...(inviterId ? { inviterId } : {}) },
        ...(inviterId ? {} : { $setOnInsert: { inviterId: null } }),
      },
      { upsert: true },
    );
    return ok(undefined);
  } catch (err) {
    logger.error(`[InviteUsage] recordConsumedInvite failed guild=${guildId}: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się zapisać zużytego zaproszenia.');
  }
}

/** Oznacza zaproszenie jako usunięte (inviteDelete) - licznik zostaje w historii. */
export async function markInviteDeleted(guildId: string, code: string): Promise<ServiceResult<void>> {
  try {
    await InviteUsageModel.updateOne({ guildId, code }, { $set: { deleted: true } });
    return ok(undefined);
  } catch (err) {
    logger.error(`[InviteUsage] markInviteDeleted failed guild=${guildId}: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się oznaczyć zaproszenia jako usuniętego.');
  }
}

/**
 * Suma użyć wszystkich zaproszeń danej osoby (także nieistniejących). `null` - bot nie zna
 * żadnego zaproszenia tej osoby.
 */
export async function getInviterTotalUses(guildId: string, inviterId: string): Promise<ServiceResult<number | null>> {
  try {
    const [row] = await InviteUsageModel.aggregate<{ total: number; count: number }>([
      { $match: { guildId, inviterId } },
      { $group: { _id: null, total: { $sum: '$uses' }, count: { $sum: 1 } } },
    ]);
    return ok(row && row.count > 0 ? row.total : null);
  } catch (err) {
    logger.error(`[InviteUsage] getInviterTotalUses failed guild=${guildId}: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się policzyć zaproszeń.');
  }
}
