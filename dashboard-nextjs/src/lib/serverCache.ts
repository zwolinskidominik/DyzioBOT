import redis from "./redis";

// ---------------------------------------------------------------------------
// Redis-backed server cache for Discord API responses.
// Survives deploys/restarts. Shared across all server processes.
//
// Keys:
//   discord:{type}:{guildId}        — fresh entry, TTL = FRESH_TTL
//   discord:stale:{type}:{guildId}  — stale fallback, TTL = STALE_TTL
// ---------------------------------------------------------------------------

const FRESH_TTL = {
  channels: 300,  // 5 min
  roles:    300,
  members:  300,
  guild:    300,
  // Per-user cache, keyed by Discord user ID (not guildId — key() doesn't care,
  // it just treats the second param as an opaque ID). Longer TTL than guild
  // data: a user's tag/avatar changes far less often than guild membership,
  // and this is the fallback for users who left/were banned (moderation logs,
  // audit logs), so we want it to stick around.
  user:     1800, // 30 min
} as const;

const STALE_TTL = {
  channels: 1800, // 30 min — returned when Discord API is down
  roles:    1800,
  members:  1800,
  guild:    1800,
  user:     86400, // 24h
} as const;

type CacheType = keyof typeof FRESH_TTL;

function key(type: CacheType, guildId: string, stale = false): string {
  return stale
    ? `discord:stale:${type}:${guildId}`
    : `discord:${type}:${guildId}`;
}

export async function getFromCache<T>(
  type: CacheType,
  guildId: string,
  allowStale = false,
): Promise<T | null> {
  try {
    const raw = await redis.get(key(type, guildId));
    if (raw) return JSON.parse(raw) as T;

    if (allowStale) {
      const staleRaw = await redis.get(key(type, guildId, true));
      if (staleRaw) return JSON.parse(staleRaw) as T;
    }
  } catch {
    // Redis unavailable — treat as cache miss
  }
  return null;
}

export async function setInCache<T>(
  type: CacheType,
  guildId: string,
  data: T,
): Promise<void> {
  try {
    const serialized = JSON.stringify(data);
    // Write both keys atomically via pipeline
    await redis
      .pipeline()
      .setex(key(type, guildId), FRESH_TTL[type], serialized)
      .setex(key(type, guildId, true), STALE_TTL[type], serialized)
      .exec();
  } catch {
    // Redis unavailable — skip caching, not fatal
  }
}

export async function invalidateCache(
  type: CacheType,
  guildId: string,
): Promise<void> {
  try {
    await redis.del(key(type, guildId), key(type, guildId, true));
  } catch {
    // ignore
  }
}
