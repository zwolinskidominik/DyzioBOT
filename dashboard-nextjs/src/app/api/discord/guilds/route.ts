import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { getCachedGuildList, setCachedGuildList, type CachedDiscordGuild } from "@/lib/discordGuildCache";

const CACHE_TTL_SECONDS = 60;
const STALE_CACHE_TTL_SECONDS = CACHE_TTL_SECONDS * 30;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cacheKey = `guilds:${session.user?.id}`;
    const userId = session.user?.id ?? "unknown";

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

    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429 && staleData) {
        return NextResponse.json(staleData);
      }

      console.error("Discord API error:", response.status, errorText);

      return NextResponse.json(
        { error: "Failed to fetch guilds from Discord" },
        { status: response.status }
      );
    }

    const guilds = await response.json();

    const adminGuilds = guilds.filter((guild: any) => {
      const permissions = BigInt(guild.permissions);
      const ADMINISTRATOR = BigInt(0x8);
      return (permissions & ADMINISTRATOR) === ADMINISTRATOR;
    });

    let botGuildIds: string[] = [];
    try {
      const botResponse = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      });

      if (botResponse.ok) {
        const botGuilds = await botResponse.json();
        botGuildIds = botGuilds.map((g: any) => g.id);
      }
    } catch (err) {
      console.error("Failed to fetch bot guilds:", err);
    }

    const guildsWithBotStatus: CachedDiscordGuild[] = adminGuilds.map((guild: any) => ({
      ...guild,
      hasBot: botGuildIds.includes(guild.id),
    }));

    // Store in Redis (fresh + stale)
    try {
      const serialized = JSON.stringify(guildsWithBotStatus);
      setCachedGuildList(userId, guildsWithBotStatus);
      await redis
        .pipeline()
        .setex(cacheKey, CACHE_TTL_SECONDS, serialized)
        .setex(`${cacheKey}:stale`, STALE_CACHE_TTL_SECONDS, serialized)
        .exec();
    } catch {
      setCachedGuildList(userId, guildsWithBotStatus);
      // Redis unavailable — skip caching
    }

    return NextResponse.json(guildsWithBotStatus);
  } catch (error) {
    console.error("Error fetching guilds:", error);
    return NextResponse.json(
      { error: "Failed to fetch guilds" },
      { status: 500 }
    );
  }
}
