import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { NextRequest, NextResponse } from "next/server";
import redis from "@/lib/redis";
import { getCachedGuildList, setCachedGuildList, type CachedDiscordGuild } from "@/lib/discordGuildCache";
import { fetchDiscordUserGuildsDeduped } from "@/lib/discordUserGuilds";
import { getDiscordAccessToken } from "@/lib/discordSessionToken";

const CACHE_TTL_SECONDS = 60;
const STALE_CACHE_TTL_SECONDS = CACHE_TTL_SECONDS * 30;

/**
 * Lista serwerów, na których jest bot. null = Discord nie odpowiedział poprawnie — wtedy NIE
 * wolno uznać, że bota nigdzie nie ma (wszystkie kafelki pokazałyby „Dodaj bota”).
 */
async function fetchBotGuildIds(): Promise<string[] | null> {
  try {
    const botResponse = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      cache: "no-store",
    });
    if (!botResponse.ok) return null;
    const botGuilds: unknown = await botResponse.json();
    return Array.isArray(botGuilds)
      ? botGuilds
          .filter((g): g is { id: string } => !!g && typeof g === "object" && typeof (g as { id?: unknown }).id === "string")
          .map((g) => g.id)
      : null;
  } catch (err) {
    console.error("Failed to fetch bot guilds:", err);
    return null;
  }
}

async function storeGuildList(userId: string, cacheKey: string, guilds: CachedDiscordGuild[]) {
  setCachedGuildList(userId, guilds);
  try {
    const serialized = JSON.stringify(guilds);
    await redis
      .pipeline()
      .setex(cacheKey, CACHE_TTL_SECONDS, serialized)
      .setex(`${cacheKey}:stale`, STALE_CACHE_TTL_SECONDS, serialized)
      .exec();
  } catch {
    // Redis unavailable — skip caching
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const accessToken = getDiscordAccessToken(session);
    if (!session || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.error) {
      return NextResponse.json({ error: "DISCORD_TOKEN_EXPIRED" }, { status: 401 });
    }

    const cacheKey = `guilds:${session.user?.id}`;
    const userId = session.user?.id ?? "unknown";

    // ?fresh=1 — po dodaniu bota (okno zaproszenia) lista z cache (60 s) nadal mówiłaby
    // „Dodaj bota”. Serwery użytkownika bierzemy z cache, ale obecność bota liczymy od nowa.
    if (request.nextUrl.searchParams.get("fresh") === "1") {
      const cached = getCachedGuildList(userId, STALE_CACHE_TTL_SECONDS * 1000);
      if (cached) {
        const botGuildIds = await fetchBotGuildIds();
        if (botGuildIds) {
          const refreshed = cached.map((guild) => ({
            ...guild,
            hasBot: botGuildIds.includes(guild.id),
          }));
          await storeGuildList(userId, cacheKey, refreshed);
          return NextResponse.json(refreshed);
        }
        return NextResponse.json(cached);
      }
    }

    const memoryFresh = getCachedGuildList(userId, CACHE_TTL_SECONDS * 1000);
    if (memoryFresh) return NextResponse.json(memoryFresh);

    // Try Redis cache first
    let staleData: unknown = getCachedGuildList(userId, STALE_CACHE_TTL_SECONDS * 1000);
    try {
      const raw = await redis.get(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedDiscordGuild[];
        setCachedGuildList(userId, parsed);
        return NextResponse.json(parsed);
      }
      // Keep stale for 429 fallback (separate key with longer TTL)
      const staleRaw = await redis.get(`${cacheKey}:stale`);
      if (staleRaw) staleData = JSON.parse(staleRaw) as unknown;
    } catch {
      // Redis unavailable — proceed without cache
    }

    const userGuildsResult = await fetchDiscordUserGuildsDeduped(userId, accessToken);

    if (!userGuildsResult.ok) {
      if (userGuildsResult.status === 429 && staleData) {
        return NextResponse.json(staleData);
      }

      // Discord odrzucił token użytkownika (wygasł albo został cofnięty) — interfejs prosi
      // wtedy o ponowne logowanie zamiast pokazywać mylące „Brak dostępnych serwerów”.
      if (userGuildsResult.status === 401) {
        return NextResponse.json({ error: "DISCORD_TOKEN_EXPIRED" }, { status: 401 });
      }

      console.error("Discord API error:", userGuildsResult.status, userGuildsResult.errorText);

      return NextResponse.json(
        { error: "Failed to fetch guilds from Discord" },
        { status: userGuildsResult.status || 502 }
      );
    }

    const adminGuilds = userGuildsResult.guilds.filter((guild) => {
      const permissions = BigInt(guild.permissions);
      const ADMINISTRATOR = BigInt(0x8);
      return (permissions & ADMINISTRATOR) === ADMINISTRATOR;
    });

    const botGuildIds = await fetchBotGuildIds();

    const guildsWithBotStatus: CachedDiscordGuild[] = adminGuilds.map((guild) => ({
      ...guild,
      hasBot: botGuildIds ? botGuildIds.includes(guild.id) : undefined,
    }));

    // Bez listy serwerów bota nie zapisujemy wyniku do cache — inaczej przez minutę (i dłużej
    // jako „stale”) wszystkie serwery wyglądałyby na takie bez bota.
    if (botGuildIds) await storeGuildList(userId, cacheKey, guildsWithBotStatus);

    return NextResponse.json(guildsWithBotStatus);
  } catch (error) {
    console.error("Error fetching guilds:", error);
    return NextResponse.json(
      { error: "Failed to fetch guilds" },
      { status: 500 }
    );
  }
}
