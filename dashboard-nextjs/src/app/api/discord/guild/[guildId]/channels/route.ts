import { NextResponse } from "next/server";
import { quickAuthCheck } from "@/lib/auth";
import { getFromCache, setInCache } from "@/lib/serverCache";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    // Quick auth check with caching
    const auth = await quickAuthCheck(request);
    if (!auth.authorized) {
      return auth.response!;
    }

    const { guildId } = await params;

    // Check server-side cache first
    const cached = getFromCache<any>('channels', guildId);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'CDN-Cache-Control': 'public, s-maxage=300',
        },
      });
    }

    // Fetch from Discord with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Discord API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Failed to fetch channels: ${response.status} ${response.statusText}`);
      }

      const channels = await response.json();
      
      // Cache the result
      setInCache('channels', guildId, channels);
      
      return NextResponse.json(channels, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'CDN-Cache-Control': 'public, s-maxage=300',
        },
      });
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error('Discord API timeout for channels');
        return NextResponse.json({ error: "Request timeout" }, { status: 504 });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
