export interface CachedDiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
  hasBot?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const guildListCache = new Map<string, CacheEntry<CachedDiscordGuild[]>>();

export function getCachedGuildList(userId: string, maxAgeMs: number): CachedDiscordGuild[] | null {
  const cached = guildListCache.get(userId);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > maxAgeMs) {
    guildListCache.delete(userId);
    return null;
  }

  return cached.data;
}

export function getCachedGuildFromList(
  userId: string,
  guildId: string,
  maxAgeMs: number,
): CachedDiscordGuild | null {
  return getCachedGuildList(userId, maxAgeMs)?.find((guild) => guild.id === guildId) ?? null;
}

export function setCachedGuildList(userId: string, data: CachedDiscordGuild[]): void {
  guildListCache.set(userId, { data, timestamp: Date.now() });
}
