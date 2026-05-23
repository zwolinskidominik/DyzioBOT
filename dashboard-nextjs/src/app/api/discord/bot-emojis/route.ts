import { NextResponse } from "next/server";
import { quickAuthCheck } from "@/lib/auth";
import redis from "@/lib/redis";

const OWNER_GUILD_IDS = ["881293681783623680", "1264582308003053570"] as const;
const CACHE_KEY = "discord:bot-emojis";
const CACHE_TTL = 3600; // 1h — emoji lists change rarely

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await quickAuthCheck(request);
    if (!auth.authorized) {
      return auth.response!;
    }

    // Try Redis cache first
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return NextResponse.json(JSON.parse(cached), {
          headers: { "Cache-Control": "public, s-maxage=3600" },
        });
      }
    } catch {
      // Redis unavailable — proceed to Discord API
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
    }

    const emojiIds: string[] = [];

    await Promise.allSettled(
      OWNER_GUILD_IDS.map(async (guildId) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/emojis`,
            {
              headers: { Authorization: `Bot ${botToken}` },
              signal: controller.signal,
            }
          );
          clearTimeout(timeout);
          if (!response.ok) {
            console.error(`Failed to fetch emojis for guild ${guildId}: ${response.status}`);
            return;
          }
          const emojis: { id: string }[] = await response.json();
          for (const emoji of emojis) {
            if (emoji.id) emojiIds.push(emoji.id);
          }
        } catch (err: any) {
          clearTimeout(timeout);
          if (err.name !== "AbortError") {
            console.error(`Error fetching emojis for guild ${guildId}:`, err);
          }
        }
      })
    );

    const result = { emojiIds };

    // Cache in Redis
    try {
      await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(result));
    } catch {
      // Redis unavailable — skip caching
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch (error) {
    console.error("Error fetching bot emojis:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
