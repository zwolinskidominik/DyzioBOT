import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const allEmojis: any[] = [];

    for (const guild of guilds) {
      try {
        const emojisResponse = await fetch(
          `https://discord.com/api/v10/guilds/${guild.id}/emojis`,
          {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );

        if (emojisResponse.ok) {
          const emojis = await emojisResponse.json();
          allEmojis.push(
            ...emojis.map((emoji: any) => ({
              id: emoji.id,
              name: emoji.name,
              animated: emoji.animated || false,
              url: `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`,
              guildId: guild.id,
              guildName: guild.name,
            }))
          );
        }
      } catch (error) {
        console.error(`Failed to fetch emojis for guild ${guild.id}:`, error);
      }
    }

    console.log(`Total emojis fetched: ${allEmojis.length}`);
    return NextResponse.json(allEmojis);
  } catch (error) {
    console.error("Error fetching emojis:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
