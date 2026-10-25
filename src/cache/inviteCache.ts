import { Client, Collection, Guild, Invite } from 'discord.js';
import logger from '../utils/logger';

/**
 * Pamięć podręczna zaproszeń - służy WYŁĄCZNIE do ustalenia, którego zaproszenia użyto przy
 * dołączeniu (porównanie liczników przed/po). Trwała historia liczników (także zaproszeń, które
 * już wygasły) jest w bazie: services/inviteUsageService.ts.
 *
 * Oprócz licznika trzymamy autora, limit użyć i datę wygaśnięcia - dzięki temu zaproszenie,
 * które Discord skasował po ostatnim dozwolonym użyciu, nadal ma znanego autora, a takie, które
 * po prostu wygasło, nie jest mylone z użytym.
 */
interface CachedInvite {
  uses: number;
  inviterId: string | null;
  /** 0 = bez limitu. */
  maxUses: number;
  /** ms od epoki; null = nie wygasa. */
  expiresAt: number | null;
}

const inviteCache = new Map<string, Map<string, CachedInvite>>();

/**
 * Licznik użyć niestandardowego linku (vanity) per gildia - TRZYMANY OSOBNO, bo
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

/** Wynik wykrycia użytego zaproszenia. */
export interface DetectedInvite {
  code: string;
  inviterId: string | null;
  /**
   * Ustawione, gdy zaproszenie zniknęło z listy, bo zużyło limit - Discord nie poda już jego
   * licznika, więc to jest liczba użyć PO tym dołączeniu (do zapisania w historii).
   */
  consumedUses?: number;
}

function toCached(invite: Invite): CachedInvite {
  return {
    uses: invite.uses ?? 0,
    inviterId: invite.inviter?.id ?? null,
    maxUses: invite.maxUses ?? 0,
    expiresAt: invite.expiresTimestamp ?? null,
  };
}

/**
 * Pobiera dane vanity dla gildii (best-effort). Zwraca null, gdy serwer nie ma takiego linku
 * albo bot nie ma uprawnienia Zarządzanie serwerem - wtedy po prostu nie śledzimy tej ścieżki.
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
 * Zapisuje pełny stan zaproszeń gildii (zastępuje poprzedni).
 *
 * `vanityUses` jest opcjonalne - gdy nie podano, licznik vanity zostaje nietknięty.
 */
export async function cacheGuildInvites(
  guildId: string,
  invites: Collection<string, Invite>,
  vanityUses?: number | null,
): Promise<void> {
  const map = new Map<string, CachedInvite>();
  for (const [code, invite] of invites) {
    map.set(code, toCached(invite));
  }
  inviteCache.set(guildId, map);
  if (typeof vanityUses === 'number') vanityUsesCache.set(guildId, vanityUses);
}

/**
 * Dopisuje JEDNO nowe zaproszenie (inviteCreate). Nie pobieramy całej listy od nowa, bo
 * wyrzuciłoby to z pamięci zaproszenie, które właśnie zniknęło po zużyciu limitu, a którego
 * dołączenie jeszcze nie zostało przetworzone.
 */
export function addInviteToCache(guildId: string, invite: Invite): void {
  const map = inviteCache.get(guildId);
  if (!map) return; // brak stanu wyjściowego - pierwsze dołączenie i tak go zbuduje
  map.set(invite.code, toCached(invite));
}

/**
 * Pobiera zaproszenia wszystkich gildii bota. `onGuildInvites` dostaje każdą pobraną listę
 * (np. do zapisania liczników w bazie).
 */
export async function cacheAllGuildInvites(
  client: Client,
  onGuildInvites?: (guildId: string, invites: Collection<string, Invite>) => Promise<void>,
): Promise<void> {
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const invites = await guild.invites.fetch();
      const vanity = await fetchGuildVanity(guild);
      await cacheGuildInvites(guildId, invites, vanity?.uses ?? null);
      if (onGuildInvites) await onGuildInvites(guildId, invites);
    } catch (error) {
      logger.warn(`[InviteCache] Nie można pobrać zaproszeń dla ${guild.name}: ${error}`);
    }
  }
}

/** Zapamiętany licznik użyć vanity (undefined = jeszcze nie znamy stanu wyjściowego). */
export function getCachedVanityUses(guildId: string): number | undefined {
  return vanityUsesCache.get(guildId);
}

/** Liczniki użyć zaproszeń gildii z pamięci (kod → użycia). */
export function getCachedInvites(guildId: string): Map<string, number> | undefined {
  const map = inviteCache.get(guildId);
  if (!map) return undefined;
  return new Map([...map].map(([code, inv]) => [code, inv.uses]));
}

/**
 * Porównuje zapamiętany stan z aktualną listą zaproszeń i ustala, którego użyto.
 * Po porównaniu pamięć dostaje aktualny stan.
 *
 * Kolejność:
 *  1. zaproszenie, któremu wzrósł licznik - pewne;
 *  2. niestandardowy link (vanity), któremu wzrósł licznik - pewne;
 *  3. zaproszenie, które zniknęło, bo właśnie zużyło limit użyć (uses + 1 >= maxUses) i nie
 *     wygasło - Discord kasuje je przy ostatnim użyciu; autora znamy z pamięci.
 *     Zaproszenia, które zniknęły z innego powodu (wygasły, ktoś je usunął), są ignorowane.
 */
export async function detectUsedInvite(
  guildId: string,
  newInvites: Collection<string, Invite>,
  vanity?: VanityData | null,
  now: number = Date.now(),
): Promise<DetectedInvite | null> {
  const oldInvites = inviteCache.get(guildId);
  const oldVanityUses = vanityUsesCache.get(guildId);
  const refresh = (vanityUses: number | null) => cacheGuildInvites(guildId, newInvites, vanityUses);

  if (!oldInvites) {
    await refresh(vanity?.uses ?? null);
    return null;
  }

  for (const [code, invite] of newInvites) {
    const oldUses = oldInvites.get(code)?.uses ?? 0;
    if ((invite.uses ?? 0) > oldUses) {
      await refresh(vanity?.uses ?? null);
      return { code, inviterId: invite.inviter?.id ?? null };
    }
  }

  if (vanity && typeof oldVanityUses === 'number' && vanity.uses > oldVanityUses) {
    await refresh(vanity.uses);
    return { code: vanity.code, inviterId: null };
  }

  const consumed = [...oldInvites].filter(([code, inv]) =>
    !newInvites.has(code) &&
    inv.maxUses > 0 &&
    inv.uses + 1 >= inv.maxUses &&
    (inv.expiresAt === null || inv.expiresAt > now),
  );

  await refresh(vanity?.uses ?? null);

  // Dwa zużyte naraz - nie da się rozstrzygnąć, które było tym dołączeniem.
  if (consumed.length === 1) {
    const [code, inv] = consumed[0];
    return { code, inviterId: inv.inviterId, consumedUses: inv.uses + 1 };
  }
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
 * Resets entire cache - for testing.
 */
export function _resetCache(): void {
  inviteCache.clear();
  vanityUsesCache.clear();
}
