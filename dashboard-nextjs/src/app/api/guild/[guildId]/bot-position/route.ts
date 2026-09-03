import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import { fetchGuildRoles } from "@/lib/discordGuildData";

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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const botId = process.env.DISCORD_CLIENT_ID;

    if (!botId) {
      return NextResponse.json({ botMaxPosition: 0 });
    }

    // Role: przez współdzielony cache ('roles', ten sam co /api/guild/[guildId]/roles
    // i inne trasy) — bez tego strona Auto Role przy jednym otwarciu odpytywała
    // Discorda o pełną listę ról DWA RAZY niezależnie w tym samym momencie.
    const [allRoles, botMemberRes] = await Promise.all([
      fetchGuildRoles(guildId).catch(() => null),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${botId}`, {
        headers: { Authorization: `Bot ${botToken}` },
      }),
    ]);

    if (!allRoles || !botMemberRes.ok) {
      return NextResponse.json({ botMaxPosition: 0 });
    }

    const botMember: { roles: string[] } = await botMemberRes.json();

    const rolePositionMap = new Map(
      (allRoles as Array<{ id: string; position: number }>).map((r) => [r.id, r.position])
    );
    const botMaxPosition = botMember.roles.reduce((max, roleId) => {
      return Math.max(max, rolePositionMap.get(roleId) ?? 0);
    }, 0);

    return NextResponse.json({ botMaxPosition });
  } catch (error) {
    console.error("Error fetching bot position:", error);
    return NextResponse.json({ botMaxPosition: 0 });
  }
}
