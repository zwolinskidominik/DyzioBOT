import type { Guild } from 'discord.js';
import mongoose from 'mongoose';
import { GuildSettingsModel } from '../models/GuildSettings';
import logger from '../utils/logger';
import { DEFAULT_LANG, isLang, langFromDiscordLocale, type Lang } from './index';

/**
 * Język serwera z GuildSettings z krótką pamięcią podręczną - zmiana w dashboardzie dociera do bota
 * najpóźniej po CACHE_TTL_MS. Błąd bazy nigdy nie blokuje odpowiedzi: wtedy język domyślny.
 */

export const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { lang: Lang; at: number }>();

/** Podmienialne w testach (readyState Mongoose nie da się zamockować). */
export const languageDeps = {
  dbReady: (): boolean => mongoose.connection.readyState === mongoose.ConnectionStates.connected,
};

export async function getGuildLanguage(guildId: string | null | undefined, now: number = Date.now()): Promise<Lang> {
  // Prywatne wiadomości nie mają ustawień serwera.
  if (!guildId) return DEFAULT_LANG;
  const hit = cache.get(guildId);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.lang;
  // Bez połączenia z bazą Mongoose czekałby do 10 s (buforowanie) - odpowiedź nie może na to czekać.
  if (!languageDeps.dbReady()) return hit?.lang ?? DEFAULT_LANG;
  try {
    const settings = await GuildSettingsModel.findOne({ guildId }).select({ language: 1 }).lean();
    const lang = isLang(settings?.language) ? settings.language : DEFAULT_LANG;
    cache.set(guildId, { lang, at: now });
    return lang;
  } catch (err) {
    logger.warn(`[i18n] Nie udało się odczytać języka serwera ${guildId}: ${err}`);
    return hit?.lang ?? DEFAULT_LANG;
  }
}

/**
 * Nowy serwer: język z ustawień Discorda serwera. Tylko przy pierwszym dołączeniu - serwer, który
 * wraca, zachowuje wcześniej wybrany język ($setOnInsert).
 */
export async function initGuildLanguage(guild: Pick<Guild, 'id' | 'preferredLocale'>): Promise<Lang> {
  const lang = langFromDiscordLocale(guild.preferredLocale);
  try {
    const doc = await GuildSettingsModel.findOneAndUpdate(
      { guildId: guild.id },
      { $setOnInsert: { guildId: guild.id, language: lang } },
      { upsert: true, returnDocument: 'after' }
    ).lean();
    const saved = isLang(doc?.language) ? doc.language : lang;
    cache.set(guild.id, { lang: saved, at: Date.now() });
    return saved;
  } catch (err) {
    logger.warn(`[i18n] Nie udało się zapisać języka nowego serwera ${guild.id}: ${err}`);
    return lang;
  }
}

/** Tylko dla testów. */
export function clearGuildLanguageCache(): void {
  cache.clear();
}
