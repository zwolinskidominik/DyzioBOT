import { NextResponse } from "next/server";
import { quickAuthCheck } from "@/lib/auth";
import { getFromCache, setInCache } from "@/lib/serverCache";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const auth = await quickAuthCheck(request);
    if (!auth.authorized) {
      return auth.response!;
    }

    const { guildId } = await params;

    const cached = getFromCache<any>('members', guildId);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
          'CDN-Cache-Control': 'public, s-maxage=120',
        },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
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
        throw new Error(`Failed to fetch members: ${response.status} ${response.statusText}`);
      }

      const members = await response.json();
      
      const simplifiedMembers = members.map((member: any) => ({
        id: member.user.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
        nickname: member.nick,
      }));

      setInCache('members', guildId, simplifiedMembers);

      return NextResponse.json(simplifiedMembers, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
          'CDN-Cache-Control': 'public, s-maxage=120',
        },
      });
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error('Discord API timeout for members');
        return NextResponse.json({ error: "Request timeout" }, { status: 504 });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
