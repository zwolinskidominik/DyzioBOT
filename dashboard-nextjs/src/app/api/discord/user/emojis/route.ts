import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

// Server-side emoji cache: keyed by user ID, TTL 5 minutes
const emojiCache = new Map<string, { data: any[]; timestamp: number }>();
const EMOJI_CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user?.id || 'unknown';
    
    // Check cache first
    const cached = emojiCache.get(userId);
    if (cached && Date.now() - cached.timestamp < EMOJI_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const guildsResponse = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!guildsResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch guilds" }, { status: 500 });
    }

    const guilds = await guildsResponse.json();
    console.log(`Fetching emojis from ${guilds.length} guilds`);

    // Fetch emojis from all guilds in parallel (batches of 10 to respect rate limits)
    const BATCH_SIZE = 10;
    const allEmojis: any[] = [];

    for (let i = 0; i < guilds.length; i += BATCH_SIZE) {
      const batch = guilds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (guild: any) => {
          const emojisResponse = await fetch(
            `https://discord.com/api/v10/guilds/${guild.id}/emojis`,
            {
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              },
            }
          );

          if (!emojisResponse.ok) return [];

          const emojis = await emojisResponse.json();
          return emojis.map((emoji: any) => ({
            id: emoji.id,
            name: emoji.name,
            animated: emoji.animated || false,
            url: `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=48&quality=lossless`,
            guildId: guild.id,
            guildName: guild.name,
          }));
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          allEmojis.push(...result.value);
        }
      }
    }

    console.log(`Total emojis fetched: ${allEmojis.length}`);
    
    // Cache the result
    emojiCache.set(userId, { data: allEmojis, timestamp: Date.now() });

    return NextResponse.json(allEmojis);
  } catch (error) {
    console.error("Error fetching emojis:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
