import Redis from "ioredis";

// ---------------------------------------------------------------------------
// Shared Redis client singleton
// Uses globalThis to survive Next.js hot-reload in development.
// In production (next start) there is one process — one connection.
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var _redisClient: Redis | undefined;
}

const redis: Redis =
  globalThis._redisClient ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    commandTimeout: 500,
    enableOfflineQueue: false,
  });

// Prevent "Unhandled error event" noise when Redis is unavailable (e.g. local dev without Docker).
// All callers already use try/catch and fail open — this just silences the uncaught event.
if (!redis.listenerCount("error")) {
  redis.on("error", () => {
    // intentionally silent — Redis unavailable is handled at call sites
  });
}

if (process.env.NODE_ENV !== "production") {
  globalThis._redisClient = redis;
}

export default redis;
