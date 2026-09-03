import { getFromCache, setInCache } from "@/lib/serverCache";

// ---------------------------------------------------------------------------
// Wspólny, bezpieczny dla rate limitów sposób odzyskiwania danych userów z
// Discord API dla listy ID (urodziny, moderacja, audit logi — wszędzie tam,
// gdzie dashboard ma listę userId z Mongo i chce pokazać obok nich tag/avatar).
//
// Historia buga: te trasy osobno robiły Promise.all(userIds.map(id =>
// fetch(`/users/${id}`))) — dla guildy z większą liczbą wpisów to natychmiast
// łapało 429 z Discorda (request per-user, zero throttlingu), a każdy request
// który dostał 429 po cichu wracał bez danych, więc UI pokazywało surowe ID
// zamiast nazwy. Ten moduł zamiast tego:
//   1. Najpierw sprawda listę członków serwera (JEDEN request na całą guildę,
//      cache 'members' współdzielony z /api/discord/guild/[guildId]/members)
//      — pokrywa większość przypadków za darmo.
//   2. Dla userów spoza tej listy (opuścili serwer, zbanowani — częste w
//      moderacji) odpytuje indywidualnie, ale z ograniczoną współbieżnością
//      i z per-user cache (długi TTL — tag/avatar rzadko się zmienia).
// ---------------------------------------------------------------------------

export interface SimplifiedDiscordUser {
  id: string;
  username: string;
  discriminator: string;
  globalName: string | null;
  avatar: string | null;
  /** Nick na serwerze — ustawiony tylko gdy user został znaleziony na liście członków. */
  nickname: string | null;
}

interface RawGuildMember {
  user: {
    id: string;
    username: string;
    discriminator: string;
    global_name: string | null;
    avatar: string | null;
  };
  nick: string | null;
}

interface RawDiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
}

/**
 * Pełna lista członków serwera — jeden request na guildę (do 1000 członków,
 * limit Discord API), zamiast jednego requestu per user. Cache współdzielony
 * z /api/discord/guild/[guildId]/members i /api/discord/guild/[guildId]/bulk
 * (ten sam klucz 'members'), więc to często darmowy cache-hit.
 */
export async function fetchGuildMembersMap(guildId: string): Promise<Map<string, SimplifiedDiscordUser>> {
  const map = new Map<string, SimplifiedDiscordUser>();

  const cached = await getFromCache<SimplifiedDiscordUser[]>('members', guildId);
  if (cached) {
    for (const member of cached) map.set(member.id, member);
    return map;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const stale = await getFromCache<SimplifiedDiscordUser[]>('members', guildId, true);
      if (stale) for (const member of stale) map.set(member.id, member);
      return map;
    }

    const members = (await response.json()) as RawGuildMember[];
    const simplified: SimplifiedDiscordUser[] = members.map((m) => ({
      id: m.user.id,
      username: m.user.username,
      discriminator: m.user.discriminator,
      globalName: m.user.global_name,
      avatar: m.user.avatar,
      nickname: m.nick,
    }));

    await setInCache('members', guildId, simplified);
    for (const member of simplified) map.set(member.id, member);
    return map;
  } catch {
    clearTimeout(timeoutId);
    const stale = await getFromCache<SimplifiedDiscordUser[]>('members', guildId, true);
    if (stale) for (const member of stale) map.set(member.id, member);
    return map;
  }
}

const STRAGGLER_CONCURRENCY = 5;

async function resolveSingleUser(id: string): Promise<SimplifiedDiscordUser | null> {
  const cached = await getFromCache<SimplifiedDiscordUser>('user', id);
  if (cached) return cached;

  try {
    const response = await fetch(`https://discord.com/api/v10/users/${id}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    });
    if (!response.ok) {
      // 429 lub inny błąd — nie dobijaj się dalej w tym requeście, przeterminowany
      // cache (jeśli jest) to i tak lepiej niż nic.
      const stale = await getFromCache<SimplifiedDiscordUser>('user', id, true);
      return stale ?? null;
    }
    const user = (await response.json()) as RawDiscordUser;
    const simplified: SimplifiedDiscordUser = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      globalName: user.global_name,
      avatar: user.avatar,
      nickname: null,
    };
    await setInCache('user', id, simplified);
    return simplified;
  } catch {
    const stale = await getFromCache<SimplifiedDiscordUser>('user', id, true);
    return stale ?? null;
  }
}

/**
 * Odzyskuje dane userów Discorda dla listy ID — członków serwera za darmo (z
 * cache listy członków), resztę (opuścili serwer / zbanowani / itp.) przez
 * ograniczoną liczbę równoległych zapytań, każde z osobnym, długim cache.
 * Nigdy nie strzela więcej niż STRAGGLER_CONCURRENCY requestów do Discorda
 * naraz — to jest dokładnie to, czego brakowało w oryginalnym buggu.
 */
export async function resolveDiscordUsers(
  guildId: string,
  userIds: string[]
): Promise<Map<string, SimplifiedDiscordUser | null>> {
  const uniqueIds = Array.from(new Set(userIds));
  const result = new Map<string, SimplifiedDiscordUser | null>();
  if (uniqueIds.length === 0) return result;

  const members = await fetchGuildMembersMap(guildId);
  const stragglers: string[] = [];
  for (const id of uniqueIds) {
    const member = members.get(id);
    if (member) {
      result.set(id, member);
    } else {
      stragglers.push(id);
    }
  }

  if (stragglers.length === 0) return result;

  let cursor = 0;
  async function worker() {
    while (cursor < stragglers.length) {
      const id = stragglers[cursor++];
      result.set(id, await resolveSingleUser(id));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(STRAGGLER_CONCURRENCY, stragglers.length) }, worker)
  );

  return result;
}

/** Najlepsza dostępna nazwa do wyświetlenia: nick na serwerze > globalna display name > username. */
export function displayNameOf(user: SimplifiedDiscordUser): string {
  return user.nickname ?? user.globalName ?? user.username;
}
