import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { NextResponse } from "next/server";

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - guild info rarely changes

export const dynamic = 'force-dynamic';

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

    // Check cache first
    const cacheKey = `guild-${session.user?.id}-${guildId}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
        },
      });
    }

    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
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
    const guild = guilds.find((g: any) => g.id === guildId);

    if (!guild) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    // Check if bot is in this guild
    let hasBot = false;
    try {
      const botResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      });

      hasBot = botResponse.ok;
    } catch (err) {
      console.error("Failed to check bot presence:", err);
    }

    const result = { ...guild, hasBot };
    
    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error("Error fetching guild:", error);
    return NextResponse.json(
      { error: "Failed to fetch guild" },
      { status: 500 }
    );
  }
}
