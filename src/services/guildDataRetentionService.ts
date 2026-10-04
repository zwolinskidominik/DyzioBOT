import { promises as fs } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { GuildDepartureModel } from '../models/GuildDeparture';
import { ServiceResult, ok, fail } from '../types/serviceResult';
import logger from '../utils/logger';

/**
 * Retencja danych serwerów, z których usunięto bota.
 *
 * Gdy bot znika z serwera, zapisujemy datę odejścia. Po GUILD_DATA_RETENTION_DAYS dniach
 * kasujemy wszystko, co dotyczy tego serwera: dokumenty z polem guildId we wszystkich
 * kolekcjach bazy (także tych zapisywanych przez dashboard) oraz pliki wgrane w Powitaniach.
 * Powrót bota przed upływem terminu anuluje usunięcie.
 *
 * Wartość jest zapisana w polityce prywatności (deezy.cc/privacy) — zmiana tutaj wymaga
 * aktualizacji dokumentu.
 */
export const GUILD_DATA_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Discord snowflake. Walidacja chroni przed deleteMany z pustym/dziwnym filtrem i przed path traversal. */
const SNOWFLAKE = /^\d{17,20}$/;

/** Kolekcje pomijane przy masowym usuwaniu — rejestr odejść obsługujemy osobno, na końcu. */
const SKIP_COLLECTIONS = new Set(['guilddepartures']);

/** Katalogi z plikami per serwer (bind-mount ./assets współdzielony z dashboardem). */
const GUILD_UPLOAD_DIRS: readonly string[][] = [
  ['assets', 'greetings', 'uploads'],
  ['assets', 'lobby', 'uploads'],
];

export function isValidGuildId(guildId: unknown): guildId is string {
  return typeof guildId === 'string' && SNOWFLAKE.test(guildId);
}

function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Brak połączenia z bazą danych');
  return db;
}

async function listGuildScopedCollections(): Promise<string[]> {
  const collections = await getDb().listCollections({}, { nameOnly: true }).toArray();
  return collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.') && !SKIP_COLLECTIONS.has(name));
}

/** Zapisuje odejście bota z serwera. Nie nadpisuje wcześniejszej daty, jeśli wpis już istnieje. */
export async function markGuildDeparted(guildId: string, at: Date = new Date()): Promise<ServiceResult<void>> {
  if (!isValidGuildId(guildId)) return fail('INVALID_GUILD', 'Nieprawidłowe ID serwera.');
  try {
    await GuildDepartureModel.updateOne(
      { guildId },
      { $setOnInsert: { guildId, leftAt: at } },
      { upsert: true }
    );
    return ok(undefined);
  } catch (err) {
    logger.error(`[Retention] markGuildDeparted failed guild=${guildId}: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się zapisać odejścia z serwera.');
  }
}

/** Bot wrócił na serwer — usunięcie danych zostaje anulowane. */
export async function cancelGuildDeparture(guildId: string): Promise<ServiceResult<void>> {
  if (!isValidGuildId(guildId)) return fail('INVALID_GUILD', 'Nieprawidłowe ID serwera.');
  try {
    await GuildDepartureModel.deleteOne({ guildId });
    return ok(undefined);
  } catch (err) {
    logger.error(`[Retention] cancelGuildDeparture failed guild=${guildId}: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się anulować usunięcia danych serwera.');
  }
}

/**
 * Uzgadnia rejestr odejść z rzeczywistością. Discord nie wysyła guildDelete, gdy bota usunięto
 * w czasie, kiedy był offline — dlatego porównujemy serwery, o których baza coś wie, z tymi,
 * na których bot faktycznie jest.
 *
 * Bezpiecznik: przy pustej liście obecnych serwerów (np. problem z gatewayem tuż po starcie)
 * NIC nie oznaczamy — inaczej za 30 dni skasowalibyśmy dane wszystkich serwerów.
 */
export async function reconcileGuildDepartures(
  presentGuildIds: readonly string[]
): Promise<ServiceResult<{ marked: number; cancelled: number }>> {
  if (presentGuildIds.length === 0) {
    return fail('NOT_READY', 'Brak listy serwerów bota — pomijam uzgadnianie.');
  }

  try {
    const present = new Set(presentGuildIds);
    const db = getDb();

    const known = new Set<string>();
    for (const name of await listGuildScopedCollections()) {
      const ids: unknown[] = await db.collection(name).distinct('guildId');
      for (const id of ids) {
        if (isValidGuildId(id)) known.add(id);
      }
    }

    const absent = [...known].filter((guildId) => !present.has(guildId));

    // Bezpiecznik: jeśli bot „nie widzi" ponad połowy serwerów, o których wie baza, to prawie na
    // pewno nie jest prawdziwe odejście, tylko zła instancja (np. bot developerski z innym
    // tokenem podpięty pod produkcyjną bazę) albo niepełna lista serwerów. Oznaczenie ich jako
    // opuszczonych skończyłoby się za 30 dni skasowaniem danych działających serwerów.
    if (absent.length > 0 && absent.length > known.size / 2) {
      return fail(
        'SUSPICIOUS_GUILD_LIST',
        `Bot nie widzi ${absent.length} z ${known.size} serwerów z bazy — pomijam uzgadnianie (czy to właściwa instancja/baza?).`
      );
    }

    let marked = 0;
    const now = new Date();
    for (const guildId of absent) {
      const result = await markGuildDeparted(guildId, now);
      if (result.ok) marked += 1;
    }

    // mongoose.trusted(): bot ma włączone sanitizeFilter (src/index.ts), które owija każdy operator
    // ($in, $lte, ...) w $eq i psuje zapytanie. Lista pochodzi z client.guilds.cache, nie z inputu.
    const cancelResult = await GuildDepartureModel.deleteMany({
      guildId: mongoose.trusted({ $in: [...present] }),
    });

    return ok({ marked, cancelled: cancelResult.deletedCount ?? 0 });
  } catch (err) {
    logger.error(`[Retention] reconcileGuildDepartures failed: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się uzgodnić listy serwerów.');
  }
}

async function purgeGuild(guildId: string): Promise<number> {
  if (!isValidGuildId(guildId)) throw new Error(`Odmowa usunięcia — nieprawidłowe ID serwera: ${guildId}`);

  const db = getDb();
  let deletedDocuments = 0;
  for (const name of await listGuildScopedCollections()) {
    const result = await db.collection(name).deleteMany({ guildId });
    deletedDocuments += result.deletedCount ?? 0;
  }

  for (const dir of GUILD_UPLOAD_DIRS) {
    await fs.rm(path.join(process.cwd(), ...dir, guildId), { recursive: true, force: true });
  }

  await GuildDepartureModel.deleteOne({ guildId });
  return deletedDocuments;
}

/**
 * Kasuje dane serwerów, z których bot odszedł ponad GUILD_DATA_RETENTION_DAYS dni temu.
 * Serwery obecne na liście `presentGuildIds` są pomijane (a ich wpis usuwany) — to drugi
 * bezpiecznik na wypadek, gdyby guildCreate nie anulował odejścia.
 */
export async function purgeExpiredGuildData(
  presentGuildIds: readonly string[],
  now: Date = new Date()
): Promise<ServiceResult<{ purgedGuilds: string[]; deletedDocuments: number }>> {
  try {
    const cutoff = new Date(now.getTime() - GUILD_DATA_RETENTION_DAYS * DAY_MS);
    const present = new Set(presentGuildIds);
    // trusted — patrz komentarz w reconcileGuildDepartures (sanitizeFilter). cutoff liczymy sami.
    const due = await GuildDepartureModel.find({ leftAt: mongoose.trusted({ $lte: cutoff }) }).lean();

    const purgedGuilds: string[] = [];
    let deletedDocuments = 0;

    for (const { guildId } of due) {
      if (!isValidGuildId(guildId)) {
        await GuildDepartureModel.deleteOne({ guildId });
        continue;
      }
      if (present.has(guildId)) {
        await GuildDepartureModel.deleteOne({ guildId });
        continue;
      }
      try {
        deletedDocuments += await purgeGuild(guildId);
        purgedGuilds.push(guildId);
        logger.info(`[Retention] Usunięto dane serwera ${guildId} (${GUILD_DATA_RETENTION_DAYS} dni po usunięciu bota).`);
      } catch (err) {
        // Wpis zostaje — kolejne uruchomienie spróbuje ponownie.
        logger.error(`[Retention] Nie udało się usunąć danych serwera ${guildId}: ${err}`);
      }
    }

    return ok({ purgedGuilds, deletedDocuments });
  } catch (err) {
    logger.error(`[Retention] purgeExpiredGuildData failed: ${err}`);
    return fail('INTERNAL_ERROR', 'Nie udało się usunąć wygasłych danych serwerów.');
  }
}
