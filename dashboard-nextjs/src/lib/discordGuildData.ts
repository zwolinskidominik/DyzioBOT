import { getFromCache, setInCache } from "@/lib/serverCache";
import { toSortedDiscordRoles } from "@/lib/discordOrdering";

// ---------------------------------------------------------------------------
// Współdzielone, cache'owane pobieranie ról i podstawowych danych guildy —
// ten sam cache ('roles' / 'guild' w serverCache.ts), z którego korzystają już
// /api/discord/guild/[guildId]/roles i /api/discord/guild/[guildId]/bulk.
//
// Realny problem, który to rozwiązuje: strona Auto Role przy JEDNYM otwarciu
// odpytywała Discorda o pełną listę ról DWA RAZY niezależnie — raz przez
// /api/guild/[guildId]/roles, raz przez /api/guild/[guildId]/bot-position
// (który sam sobie osobno dociągał te same role) — żadne z nich nie było
// cache'owane, mimo że identyczny cache na role już istniał i był używany
// gdzie indziej w aplikacji. Wołający ten sam helper z dwóch miejsc w tym
// samym page-load zwykle trafia w cache za drugim razem.
// ---------------------------------------------------------------------------

export async function fetchGuildRoles(guildId: string): Promise<unknown[]> {
  const cached = await getFromCache<unknown[]>('roles', guildId);
  if (cached) return toSortedDiscordRoles(cached);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Failed to fetch roles: ${response.status}`);

    const roles = toSortedDiscordRoles(await response.json());
    await setInCache('roles', guildId, roles);
    return roles;
  } catch (err) {
    clearTimeout(timeoutId);
    const stale = await getFromCache<unknown[]>('roles', guildId, true);
    if (stale) return toSortedDiscordRoles(stale);
    throw err;
  }
}

export interface GuildInfoLite {
  name: string;
  iconURL: string | null;
}

const GUILD_INFO_FALLBACK: GuildInfoLite = { name: "Serwer", iconURL: null };

export async function fetchGuildInfo(guildId: string): Promise<GuildInfoLite> {
  const cached = await getFromCache<GuildInfoLite>('guild', guildId);
  if (cached) return cached;

  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    });
    if (!res.ok) {
      const stale = await getFromCache<GuildInfoLite>('guild', guildId, true);
      return stale ?? GUILD_INFO_FALLBACK;
    }
    const guild = (await res.json()) as { name: string; icon: string | null };
    const info: GuildInfoLite = {
      name: guild.name,
      iconURL: guild.icon ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png?size=128` : null,
    };
    await setInCache('guild', guildId, info);
    return info;
  } catch {
    const stale = await getFromCache<GuildInfoLite>('guild', guildId, true);
    return stale ?? GUILD_INFO_FALLBACK;
  }
}
