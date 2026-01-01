import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

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

    // Fetch roles from Discord API
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

    const roles = await response.json();
    
    // Filter out @everyone role and sort by position
    const filteredRoles = roles
      .filter((role: any) => role.name !== "@everyone")
      .sort((a: any, b: any) => b.position - a.position);
    
    return NextResponse.json(filteredRoles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
