import { z } from 'zod';
import mongoose from 'mongoose';
import { MinecraftLinkModel, type MinecraftLinkStatus } from '../../models/MinecraftLink';
import { ServiceResult, ok, fail } from '../../types/serviceResult';
import logger from '../../utils/logger';
import {
  classifyWhitelistResponse,
  runWhitelistCommand,
  MINECRAFT_NICK,
  type RconResult,
  type RconTarget,
  type WhitelistAction,
} from './rconClient';

/**
 * Whitelista serwera GameZone. Baza trzyma stan docelowy („kto ma być na whiteliście”), a cykl co
 * minutę wyrównuje do niego serwer przez RCON, gdy ten działa. Dodawać i usuwać może tylko
 * właściciel serwera Discord i Administratorzy (sprawdzane w obsłudze przycisków).
 */

export const NickSchema = z.string().trim().regex(MINECRAFT_NICK, 'Nick: 3-16 znaków, litery, cyfry i _');

export interface WhitelistEntry {
  userId: string;
  nick: string;
  status: MinecraftLinkStatus;
}

function toEntry(doc: { userId: string; nick: string; status: MinecraftLinkStatus }): WhitelistEntry {
  return { userId: doc.userId, nick: doc.nick, status: doc.status };
}

/** Dodaje osobę albo zmienia jej nick. Stary nick (jeśli był na serwerze) zostanie z niego usunięty. */
export async function setWhitelistNick(
  guildId: string,
  userId: string,
  rawNick: string,
  adminId: string
): Promise<ServiceResult<{ entry: WhitelistEntry; changed: boolean }>> {
  const parsed = NickSchema.safeParse(rawNick);
  if (!parsed.success) return fail('INVALID_NICK', 'Nick musi mieć 3-16 znaków: litery, cyfry i podkreślenie (_).');
  const nick = parsed.data;
  const nickLower = nick.toLowerCase();

  try {
    const takenBy = await MinecraftLinkModel.findOne({ guildId, nickLower }).lean();
    if (takenBy && takenBy.userId !== userId) {
      // Nick zwalniany przez kogoś innego przejmujemy dopiero, gdy zniknie z bazy (po usunięciu z serwera).
      return takenBy.status === 'removing'
        ? fail('NICK_TAKEN', `Nick ${nick} jest właśnie usuwany z whitelisty - spróbuj po włączeniu serwera.`)
        : fail('NICK_TAKEN', `Nick ${nick} jest już przypisany do <@${takenBy.userId}>.`);
    }

    const existing = await MinecraftLinkModel.findOne({ guildId, userId });
    if (!existing) {
      const created = await MinecraftLinkModel.create({ guildId, userId, nick, nickLower, status: 'pending', addedBy: adminId });
      return ok({ entry: toEntry(created), changed: true });
    }

    const sameNick = existing.nickLower === nickLower;
    if (sameNick && existing.status === 'added') return ok({ entry: toEntry(existing), changed: false });

    if (!sameNick) {
      // Stary nick trzeba usunąć z serwera tylko wtedy, gdy mógł tam trafić. Wcześniej zaplanowane
      // usunięcie ma pierwszeństwo (status `added` zawsze oznacza brak zaległego usunięcia).
      const wasOnServer = existing.status === 'added' || existing.status === 'removing';
      existing.previousNick = existing.previousNick ?? (wasOnServer ? existing.nick : undefined);
    }
    existing.nick = nick;
    existing.nickLower = nickLower;
    existing.status = 'pending';
    existing.addedBy = adminId;
    await existing.save();
    return ok({ entry: toEntry(existing), changed: true });
  } catch (err) {
    logger.error('[MC] setWhitelistNick failed', { guildId, err });
    return fail('INTERNAL_ERROR', 'Błąd serwera.');
  }
}

/** Usuwa osobę z whitelisty (z serwera przy najbliższej okazji, z bazy po potwierdzeniu RCON). */
export async function removeFromWhitelist(guildId: string, userId: string): Promise<ServiceResult<WhitelistEntry>> {
  try {
    const existing = await MinecraftLinkModel.findOne({ guildId, userId });
    if (!existing) return fail('NOT_FOUND', 'Ta osoba nie jest na whiteliście.');
    const entry = toEntry(existing);
    const mayBeOnServer = existing.status === 'added' || existing.status === 'removing' || !!existing.previousNick;
    if (!mayBeOnServer) {
      await MinecraftLinkModel.deleteOne({ guildId, userId });
      return ok(entry);
    }
    existing.status = 'removing';
    await existing.save();
    return ok({ ...entry, status: 'removing' });
  } catch (err) {
    logger.error('[MC] removeFromWhitelist failed', { guildId, err });
    return fail('INTERNAL_ERROR', 'Błąd serwera.');
  }
}

export async function listWhitelist(guildId: string): Promise<ServiceResult<WhitelistEntry[]>> {
  try {
    const docs = await MinecraftLinkModel.find({ guildId }).sort({ nickLower: 1 }).lean();
    return ok(docs.map(toEntry));
  } catch (err) {
    logger.error('[MC] listWhitelist failed', { guildId, err });
    return fail('INTERNAL_ERROR', 'Błąd serwera.');
  }
}

/* ── Wyrównanie z serwerem ───────────────────────────────────── */

export interface WhitelistStep {
  action: WhitelistAction;
  nick: string;
  /** Co oznacza powodzenie kroku dla wpisu w bazie. */
  effect: 'clear_previous' | 'mark_added' | 'delete_entry';
}

/** Kroki dla jednego wpisu, w kolejności: najpierw usunięcie starego nicka, potem reszta. */
export function planWhitelistSteps(link: { nick: string; status: MinecraftLinkStatus; previousNick?: string | undefined }): WhitelistStep[] {
  const steps: WhitelistStep[] = [];
  if (link.previousNick) steps.push({ action: 'remove', nick: link.previousNick, effect: 'clear_previous' });
  if (link.status === 'removing') steps.push({ action: 'remove', nick: link.nick, effect: 'delete_entry' });
  if (link.status === 'pending') steps.push({ action: 'add', nick: link.nick, effect: 'mark_added' });
  return steps;
}

export type RconRunner = (target: RconTarget, action: WhitelistAction, nick: string) => Promise<RconResult>;

export interface ReconcileSummary {
  applied: number;
  /** Serwer nie przyjął połączenia (np. Minecraft się ładuje) - spróbujemy w następnym cyklu. */
  deferred: boolean;
}

/**
 * Wyrównuje whitelistę na serwerze do bazy. Zatrzymuje się przy pierwszym braku połączenia
 * (normalne, gdy Minecraft się ładuje) - reszta poczeka do następnego cyklu.
 */
export async function reconcileWhitelist(
  guildId: string,
  target: RconTarget,
  run: RconRunner = runWhitelistCommand
): Promise<ReconcileSummary> {
  // mongoose.trusted(): sanitizeFilter (index.ts) zamieniłby ręcznie pisane operatory na $eq.
  const links = await MinecraftLinkModel.find({
    guildId,
    $or: [
      { status: mongoose.trusted({ $in: ['pending', 'removing'] }) },
      { previousNick: mongoose.trusted({ $exists: true, $ne: null }) },
    ],
  });

  let applied = 0;
  for (const link of links) {
    for (const step of planWhitelistSteps(link)) {
      const result = await run(target, step.action, step.nick);
      if (!result.ok) {
        if (result.reason === 'auth') logger.error('[MC] RCON odrzucił hasło - sprawdź MC_RCON_PASSWORD.');
        if (result.reason === 'invalid_nick') {
          logger.warn(`[MC] Pominięto nieprawidłowy nick w bazie (guild=${guildId}).`);
          continue;
        }
        return { applied, deferred: true };
      }

      const outcome = classifyWhitelistResponse(step.action, result.text);
      if (outcome === 'unknown') {
        logger.warn(`[MC] Nieznana odpowiedź RCON na „whitelist ${step.action}” - spróbuję ponownie później.`);
        break;
      }

      if (step.effect === 'clear_previous') {
        link.previousNick = undefined;
      } else if (step.effect === 'delete_entry') {
        await MinecraftLinkModel.deleteOne({ _id: link._id, guildId });
        applied++;
        break;
      } else {
        // `no_such_player` - nick nie istnieje w Minecrafcie; nie ponawiamy, admin musi go poprawić.
        link.status = outcome === 'no_such_player' ? 'no_such_player' : 'added';
      }
      await link.save();
      applied++;
    }
  }
  return { applied, deferred: false };
}
