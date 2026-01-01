interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const serverCache = new Map<string, CacheEntry<any>>();

const CACHE_TTL = {
  channels: 5 * 60 * 1000, // 5 minutes - prevents rate limits
  roles: 5 * 60 * 1000, // 5 minutes - prevents rate limits
  members: 5 * 60 * 1000, // 5 minutes - prevents rate limits
  guild: 5 * 60 * 1000, // 5 minutes - prevents rate limits
};

export function getCacheKey(type: string, guildId: string): string {
  return `${type}:${guildId}`;
}

export function getFromCache<T>(type: keyof typeof CACHE_TTL, guildId: string, allowStale: boolean = false): T | null {
  const key = getCacheKey(type, guildId);
  const entry = serverCache.get(key);

  if (!entry) return null;

  const ttl = CACHE_TTL[type];
  const age = Date.now() - entry.timestamp;

  if (age > ttl) {
    if (allowStale) {
      return entry.data as T;
    }
    serverCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setInCache<T>(type: keyof typeof CACHE_TTL, guildId: string, data: T): void {
  const key = getCacheKey(type, guildId);
  serverCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateCache(type: keyof typeof CACHE_TTL, guildId: string): void {
  const key = getCacheKey(type, guildId);
  serverCache.delete(key);
}

export function clearCache(): void {
  serverCache.clear();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of serverCache.entries()) {
    const type = key.split(':')[0] as keyof typeof CACHE_TTL;
    const ttl = CACHE_TTL[type] || 5 * 60 * 1000;
    
    if (now - entry.timestamp > ttl) {
      serverCache.delete(key);
    }
  }
}, 60 * 1000);
