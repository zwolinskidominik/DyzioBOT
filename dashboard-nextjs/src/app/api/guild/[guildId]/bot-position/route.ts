import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

/**
 * Returns the highest role position the bot holds in the guild.
 * Used to validate that roles assigned via Auto Role are below the bot's position.
 */
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
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const botId = process.env.DISCORD_CLIENT_ID;

    if (!botId) {
      return NextResponse.json({ botMaxPosition: 0 });
    }

    const [rolesRes, botMemberRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${botToken}` },
      }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${botId}`, {
        headers: { Authorization: `Bot ${botToken}` },
      }),
    ]);

    if (!rolesRes.ok || !botMemberRes.ok) {
      return NextResponse.json({ botMaxPosition: 0 });
    }

    const allRoles: Array<{ id: string; position: number }> = await rolesRes.json();
    const botMember: { roles: string[] } = await botMemberRes.json();

    const rolePositionMap = new Map(allRoles.map((r) => [r.id, r.position]));
    const botMaxPosition = botMember.roles.reduce((max, roleId) => {
      return Math.max(max, rolePositionMap.get(roleId) ?? 0);
    }, 0);

    return NextResponse.json({ botMaxPosition });
  } catch (error) {
    console.error("Error fetching bot position:", error);
    return NextResponse.json({ botMaxPosition: 0 });
  }
}
