import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { NextResponse } from "next/server";

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60000; // 60 seconds - increased to reduce rate limiting

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache first
    const cacheKey = `guilds-${session.user?.id}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Discord API error:", response.status, errorText);
      
      // If rate limited and we have cached data, return it
      if (response.status === 429 && cached) {
        return NextResponse.json(cached.data);
      }
      
      return NextResponse.json(
        { error: "Failed to fetch guilds from Discord" },
        { status: response.status }
      );
    }

    const guilds = await response.json();

    // Filter guilds where user has ADMINISTRATOR permission (0x8)
    const adminGuilds = guilds.filter((guild: any) => {
      const permissions = BigInt(guild.permissions);
      const ADMINISTRATOR = BigInt(0x8);
      return (permissions & ADMINISTRATOR) === ADMINISTRATOR;
    });

    // Fetch bot guilds to check where bot is present
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

    // Add hasBot flag to each guild
    const guildsWithBotStatus = adminGuilds.map((guild: any) => ({
      ...guild,
      hasBot: botGuildIds.includes(guild.id),
    }));

    // Cache the result
    cache.set(cacheKey, { data: guildsWithBotStatus, timestamp: Date.now() });

    return NextResponse.json(guildsWithBotStatus);
  } catch (error) {
    console.error("Error fetching guilds:", error);
    return NextResponse.json(
      { error: "Failed to fetch guilds" },
      { status: 500 }
    );
  }
}
