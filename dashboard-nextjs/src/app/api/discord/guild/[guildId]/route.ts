import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import { getCachedGuildFromList, type CachedDiscordGuild } from "@/lib/discordGuildCache";
import { fetchDiscordUserGuildsDeduped, type DiscordGuildSummary } from "@/lib/discordUserGuilds";

export const dynamic = 'force-dynamic';

const FRESH_CACHE_MS = 10_000;
const STALE_CACHE_MS = 30 * 60_000;

interface GuildAvailability extends DiscordGuildSummary {
  hasBot: boolean;
  transient?: boolean;
}

interface CacheEntry {
  data: GuildAvailability;
  timestamp: number;
}

const availabilityCache = new Map<string, CacheEntry>();

function noStoreResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function getCachedAvailability(cacheKey: string, maxAgeMs: number): GuildAvailability | null {
  const cached = availabilityCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > maxAgeMs) {
    availabilityCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function cacheAvailability(cacheKey: string, data: GuildAvailability): void {
  availabilityCache.set(cacheKey, { data, timestamp: Date.now() });
}

function getRetryAfterSeconds(response: Response): string | null {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) return retryAfter;

  return null;
}

function toAvailability(guild: CachedDiscordGuild | DiscordGuildSummary): GuildAvailability {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    permissions: guild.permissions,
    hasBot: "hasBot" in guild ? guild.hasBot !== false : true,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const userId = session.user?.id ?? "unknown";
    const cacheKey = `${userId}:${guildId}`;
    const force = new URL(request.url).searchParams.get("force") === "1";
    const fresh = getCachedAvailability(cacheKey, FRESH_CACHE_MS);

    if (fresh && !force) {
      return noStoreResponse(fresh, { headers: { "X-Deezy-Cache": "fresh" } });
    }

    const cachedFromGuildList = getCachedGuildFromList(userId, guildId, FRESH_CACHE_MS);
    if (cachedFromGuildList && !force) {
      const result = toAvailability(cachedFromGuildList);
      cacheAvailability(cacheKey, result);
      return noStoreResponse(result, { headers: { "X-Deezy-Cache": "guild-list" } });
    }

    const userGuildsResult = await fetchDiscordUserGuildsDeduped(userId, session.accessToken);

    if (!userGuildsResult.ok) {
      const stale = getCachedAvailability(cacheKey, STALE_CACHE_MS);
      if (userGuildsResult.status === 429 && stale) {
        return noStoreResponse(stale, {
          headers: {
            "Retry-After": userGuildsResult.retryAfter ?? "1",
            "X-Deezy-Cache": "stale",
          },
        });
      }

      const guildListFallback = getCachedGuildFromList(userId, guildId, STALE_CACHE_MS);
      if (userGuildsResult.status === 429 && guildListFallback) {
        const result = toAvailability(guildListFallback);
        cacheAvailability(cacheKey, result);
        return noStoreResponse(result, {
          headers: {
            "Retry-After": userGuildsResult.retryAfter ?? "1",
            "X-Deezy-Cache": "guild-list-stale",
          },
        });
      }

      console.error("Discord API error:", userGuildsResult.status, userGuildsResult.errorText);

      return noStoreResponse(
        { error: "Failed to fetch guilds from Discord", transient: userGuildsResult.status === 429 },
        { status: userGuildsResult.status || 502 }
      );
    }

    const guild = userGuildsResult.guilds.find((item) => item.id === guildId);

    if (!guild) {
      availabilityCache.delete(cacheKey);
      return noStoreResponse({ error: "Guild not found" }, { status: 404 });
    }

    let hasBot = false;
    try {
      const botResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      });

      if (botResponse.ok) {
        hasBot = true;
      } else if (botResponse.status === 429) {
        const stale = getCachedAvailability(cacheKey, STALE_CACHE_MS);
        if (stale) {
          return noStoreResponse(stale, {
            headers: {
              "Retry-After": getRetryAfterSeconds(botResponse) ?? "1",
              "X-Deezy-Cache": "stale",
            },
          });
        }

        const guildListFallback = getCachedGuildFromList(userId, guildId, STALE_CACHE_MS);
        if (guildListFallback) {
          const result = toAvailability(guildListFallback);
          cacheAvailability(cacheKey, result);
          return noStoreResponse(result, {
            headers: {
              "Retry-After": getRetryAfterSeconds(botResponse) ?? "1",
              "X-Deezy-Cache": "guild-list-stale",
            },
          });
        }

        return noStoreResponse(
          { error: "Discord bot presence check rate limited", transient: true },
          {
            status: 503,
            headers: { "Retry-After": getRetryAfterSeconds(botResponse) ?? "1" },
          },
        );
      }
    } catch (err) {
      console.error("Failed to check bot presence:", err);

      const stale = getCachedAvailability(cacheKey, STALE_CACHE_MS);
      if (stale) {
        return noStoreResponse(stale, { headers: { "X-Deezy-Cache": "stale" } });
      }

      return noStoreResponse(
        { error: "Failed to verify bot presence", transient: true },
        { status: 503 },
      );
    }

    const result: GuildAvailability = { ...guild, hasBot };
    cacheAvailability(cacheKey, result);

    return noStoreResponse(result);
  } catch (error) {
    console.error("Error fetching guild:", error);
    return noStoreResponse(
      { error: "Failed to fetch guild" },
      { status: 500 }
    );
  }
}
