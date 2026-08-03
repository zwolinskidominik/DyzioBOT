import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { toSortedDiscordRoles } from "@/lib/discordOrdering";

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

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Discord API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: "Failed to fetch roles" },
        { status: response.status }
      );
    }

    const roles = toSortedDiscordRoles(await response.json());
    
    const filteredRoles = roles
      .filter((role) => role.name !== "@everyone");
    
    return NextResponse.json(filteredRoles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
