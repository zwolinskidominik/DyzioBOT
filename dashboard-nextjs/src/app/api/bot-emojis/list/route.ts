import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

const APP_EMOJIS_CACHE_KEY = "discord:app-emojis";
const APP_EMOJIS_CACHE_TTL = 300; // 5 min for public listing

interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
}

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try Redis cache first
  try {
    const cached = await redis.get(APP_EMOJIS_CACHE_KEY);
    if (cached) return NextResponse.json(JSON.parse(cached));
  } catch {
    // Redis unavailable — proceed to Discord API
  }

  const appId = process.env.DISCORD_CLIENT_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !botToken) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/applications/${appId}/emojis`,
      {
        headers: { Authorization: `Bot ${botToken}` },
        signal: controller.signal,
      }
    );
  } catch {
    return NextResponse.json({ error: "Discord API unreachable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: `Discord API error: ${response.status}` },
      { status: 502 }
    );
  }

  const data = await response.json() as { items: DiscordEmoji[] };
  const emojis = data.items ?? [];

  try {
    await redis.setex(APP_EMOJIS_CACHE_KEY, APP_EMOJIS_CACHE_TTL, JSON.stringify(emojis));
  } catch {
    // Redis unavailable — skip caching
  }

  return NextResponse.json(emojis);
}
