import { Client, Collection, Guild, Invite } from 'discord.js';
import logger from '../utils/logger';

/**
 * In-memory cache of guild invites.
 * Maps guildId → Map<inviteCode, uses>.
 */
const inviteCache = new Map<string, Map<string, number>>();

/**
 * Licznik użyć niestandardowego linku (vanity) per gildia — TRZYMANY OSOBNO, bo
 * `guild.invites.fetch()` NIE zwraca zaproszenia vanity (trzeba `guild.fetchVanityData()`).
 * Bez tego dołączenia przez discord.gg/nazwa nie dają żadnej różnicy w licznikach zwykłych
 * zaproszeń i zawsze lądowały w sytuacji „unknown".
 */
const vanityUsesCache = new Map<string, number>();

/** Dane niestandardowego linku serwera. `uses` rośnie z każdym dołączeniem przez ten link. */
export interface VanityData {
  code: string;
  uses: number;
}

/**
 * Pobiera dane vanity dla gildii (best-effort). Zwraca null, gdy serwer nie ma takiego linku
 * albo bot nie ma uprawnienia Zarządzanie serwerem — wtedy po prostu nie śledzimy tej ścieżki.
 */
export async function fetchGuildVanity(guild: Guild): Promise<VanityData | null> {
  if (!guild.vanityURLCode) return null;
  try {
    const data = await guild.fetchVanityData();
    if (!data.code) return null;
    return { code: data.code, uses: data.uses ?? 0 };
  } catch (error) {
    logger.warn(`[InviteCache] Nie można pobrać vanity dla ${guild.name}: ${error}`);
    return null;
  }
}

/**
 * Fetches all invites for a guild and stores them in the cache.
 *
 * `vanityUses` jest opcjonalne — gdy nie podano, licznik vanity zostaje nietknięty (tak działają
 * handlery inviteCreate/inviteDelete, które odświeżają tylko zwykłe zaproszenia).
 */
export async function cacheGuildInvites(
  guildId: string,
  invites: Collection<string, Invite>,
  vanityUses?: number | null,
): Promise<void> {
  const map = new Map<string, number>();
  for (const [code, invite] of invites) {
    map.set(code, invite.uses ?? 0);
  }
  inviteCache.set(guildId, map);
  if (typeof vanityUses === 'number') vanityUsesCache.set(guildId, vanityUses);
}

/**
 * Caches invites for all guilds the bot is in.
 */
export async function cacheAllGuildInvites(client: Client): Promise<void> {
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const invites = await guild.invites.fetch();
      const vanity = await fetchGuildVanity(guild);
      await cacheGuildInvites(guildId, invites, vanity?.uses ?? null);
    } catch (error) {
      logger.warn(`[InviteCache] Nie można pobrać zaproszeń dla ${guild.name}: ${error}`);
    }
  }
}

/** Zapamiętany licznik użyć vanity (undefined = jeszcze nie znamy stanu wyjściowego). */
export function getCachedVanityUses(guildId: string): number | undefined {
  return vanityUsesCache.get(guildId);
}

/**
 * Gets the cached invite uses for a guild.
 */
export function getCachedInvites(guildId: string): Map<string, number> | undefined {
  return inviteCache.get(guildId);
}

/**
 * Compares old cached invites with freshly fetched invites to find which invite was used.
 * Returns the invite code and inviter ID if detected, or null.
 */
export async function detectUsedInvite(
  guildId: string,
  newInvites: Collection<string, Invite>,
  vanity?: VanityData | null,
): Promise<{ code: string; inviterId: string | null } | null> {
  const oldInvites = inviteCache.get(guildId);
  const oldVanityUses = vanityUsesCache.get(guildId);

  if (!oldInvites) {
    // No cache — update cache and return null
    await cacheGuildInvites(guildId, newInvites, vanity?.uses ?? null);
    return null;
  }

  for (const [code, invite] of newInvites) {
    const oldUses = oldInvites.get(code) ?? 0;
    const newUses = invite.uses ?? 0;

    if (newUses > oldUses) {
      // Update cache with new state
      await cacheGuildInvites(guildId, newInvites, vanity?.uses ?? null);
      return {
        code,
        inviterId: invite.inviter?.id ?? null,
      };
    }
  }

  // Niestandardowy link (vanity) — sprawdzany PRZED heurystyką skasowanego zaproszenia,
  // bo wzrost licznika vanity to twardy sygnał, a zniknięcie zaproszenia to tylko domysł.
  // Vanity nie ma zapraszającego, więc inviterId zostaje null (sytuacja „vanity" w szablonach).
  if (vanity && typeof oldVanityUses === 'number' && vanity.uses > oldVanityUses) {
    await cacheGuildInvites(guildId, newInvites, vanity.uses);
    return { code: vanity.code, inviterId: null };
  }

  // Check if an invite was used and then deleted (single-use invite)
  for (const [code] of oldInvites) {
    if (!newInvites.has(code)) {
      // This invite disappeared — it was likely a single-use or max-use invite
      await cacheGuildInvites(guildId, newInvites, vanity?.uses ?? null);
      // We can't determine the inviter from a deleted invite
      return { code, inviterId: null };
    }
  }

  // Update the cache anyway
  await cacheGuildInvites(guildId, newInvites, vanity?.uses ?? null);
  return null;
}

/**
 * Clears cache for a guild (e.g. when bot leaves).
 */
export function clearGuildCache(guildId: string): void {
  inviteCache.delete(guildId);
  vanityUsesCache.delete(guildId);
}

/**
 * Resets entire cache — for testing.
 */
export function _resetCache(): void {
  inviteCache.clear();
  vanityUsesCache.clear();
}
