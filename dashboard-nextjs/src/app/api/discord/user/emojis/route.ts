import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getDiscordAccessToken } from "@/lib/discordSessionToken";
import { fetchDiscordUserGuildsDeduped } from "@/lib/discordUserGuilds";

interface UserEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  guildId: string;
  guildName: string;
}

interface DiscordEmoji {
  id: string | null;
  name: string | null;
  animated?: boolean;
}

// Server-side emoji cache: keyed by user ID, TTL 5 minutes
const emojiCache = new Map<string, { data: UserEmoji[]; timestamp: number }>();
const EMOJI_CACHE_TTL = 5 * 60 * 1000;
const BATCH_SIZE = 10;

function isDiscordEmojiList(value: unknown): value is DiscordEmoji[] {
  return Array.isArray(value);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = getDiscordAccessToken(session);
    const userId = session?.user?.id;
    if (!session || !accessToken || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cached = emojiCache.get(userId);
    if (cached && Date.now() - cached.timestamp < EMOJI_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const guildsResult = await fetchDiscordUserGuildsDeduped(userId, accessToken);
    if (!guildsResult.ok) {
      return NextResponse.json({ error: "Failed to fetch guilds" }, { status: 500 });
    }
    const guilds = guildsResult.guilds;

    // Emoji z serwerów użytkownika, równolegle w paczkach po 10 (limity Discorda).
    const allEmojis: UserEmoji[] = [];
    for (let i = 0; i < guilds.length; i += BATCH_SIZE) {
      const batch = guilds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (guild): Promise<UserEmoji[]> => {
          const emojisResponse = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/emojis`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
          });
          if (!emojisResponse.ok) return [];

          const emojis: unknown = await emojisResponse.json();
          if (!isDiscordEmojiList(emojis)) return [];
          return emojis.flatMap((emoji) =>
            emoji.id && emoji.name
              ? [{
                  id: emoji.id,
                  name: emoji.name,
                  animated: emoji.animated === true,
                  url: `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}?size=48&quality=lossless`,
                  guildId: guild.id,
                  guildName: guild.name,
                }]
              : []
          );
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") allEmojis.push(...result.value);
      }
    }

    emojiCache.set(userId, { data: allEmojis, timestamp: Date.now() });
    return NextResponse.json(allEmojis);
  } catch (error) {
    console.error("Error fetching emojis:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
