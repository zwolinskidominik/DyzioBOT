import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import { createAuditLog } from "@/lib/auditLog";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Discord limity: nick max 32 znaki, bio (member profile) max 190 znaków.
const MAX_NICK_LENGTH = 32;
const MAX_BIO_LENGTH = 190;
// Spójne z limitem uploadów w greetings/images.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface DiscordMemberProfile {
  nick?: string | null;
  avatar?: string | null;
  banner?: string | null;
  bio?: string | null;
}

interface DiscordGlobalUser {
  username?: string;
  avatar?: string | null;
  banner?: string | null;
}

interface DiscordApplication {
  description?: string;
}

function getCredentials(): { appId: string; botToken: string } | null {
  const appId = process.env.DISCORD_CLIENT_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !botToken) return null;
  return { appId, botToken };
}

function buildUrls(guildId: string, botUserId: string, member: DiscordMemberProfile) {
  return {
    avatarUrl: member.avatar
      ? `https://cdn.discordapp.com/guilds/${guildId}/users/${botUserId}/avatars/${member.avatar}.png?size=256`
      : null,
    bannerUrl: member.banner
      ? `https://cdn.discordapp.com/guilds/${guildId}/users/${botUserId}/banners/${member.banner}.png?size=600`
      : null,
  };
}

/**
 * Standardowy (globalny) profil bota — używany jako fallback w GET, gdy ten serwer
 * nie ma jeszcze własnych, per-guild nadpisań (nick/bio/avatar/banner puste).
 * Nie wpływa na PATCH — zapis nadal dotyczy wyłącznie profilu per-guild.
 */
async function fetchGlobalDefaults(botToken: string, botUserId: string) {
  const [userRes, appRes] = await Promise.all([
    fetch(`https://discord.com/api/v10/users/${botUserId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    }).catch(() => null),
    fetch(`https://discord.com/api/v10/applications/@me`, {
      headers: { Authorization: `Bot ${botToken}` },
    }).catch(() => null),
  ]);

  const user: DiscordGlobalUser = userRes?.ok ? await userRes.json() : {};
  const app: DiscordApplication = appRes?.ok ? await appRes.json() : {};

  return {
    defaultUsername: user.username ?? null,
    defaultAvatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${botUserId}/${user.avatar}.png?size=256`
      : null,
    defaultBannerUrl: user.banner
      ? `https://cdn.discordapp.com/banners/${botUserId}/${user.banner}.png?size=600`
      : null,
    defaultBio: app.description?.trim() ? app.description.trim() : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const accessError = await requireGuildAccess(session, guildId);
  if (accessError) return accessError;

  const creds = getCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Bot credentials not configured" }, { status: 500 });
  }

  // GET nie ma odpowiednika "/@me" dla bota (to działa tylko dla PATCH, patrz niżej) —
  // discord.js `GuildMemberManager#fetchMe()` woła zwykłe `GET /guilds/{id}/members/{userId}`
  // z ID bota, więc robimy to samo.
  let discordRes: Response;
  try {
    discordRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${creds.appId}`, {
      headers: { Authorization: `Bot ${creds.botToken}` },
    });
  } catch {
    return NextResponse.json({ error: "Discord API unreachable" }, { status: 502 });
  }

  if (!discordRes.ok) {
    return NextResponse.json(
      { error: `Nie udało się pobrać profilu bota z Discorda (${discordRes.status})` },
      { status: 502 }
    );
  }

  const member: DiscordMemberProfile = await discordRes.json();
  const defaults = await fetchGlobalDefaults(creds.botToken, creds.appId);

  return NextResponse.json({
    botUserId: creds.appId,
    nick: member.nick ?? null,
    bio: member.bio ?? null,
    ...buildUrls(guildId, creds.appId, member),
    ...defaults,
  });
}

const profilePatchZod = z.object({
  nick: z.string().trim().max(MAX_NICK_LENGTH).nullable().optional(),
  bio: z.string().trim().max(MAX_BIO_LENGTH).nullable().optional(),
  // data:image/... base64 lub null (usunięcie avatara/bannera per-guild).
  avatar: z.string().nullable().optional(),
  banner: z.string().nullable().optional(),
});

function approxBase64Bytes(dataUri: string): number {
  const base64Part = dataUri.split(",")[1] ?? "";
  return Math.ceil((base64Part.length * 3) / 4);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const accessError = await requireGuildAccess(session, guildId);
  if (accessError) return accessError;

  const creds = getCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Bot credentials not configured" }, { status: 500 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = profilePatchZod.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Nieprawidłowe dane", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { nick, bio, avatar, banner } = parsed.data;

  for (const [label, value] of [
    ["avatar", avatar],
    ["banner", banner],
  ] as const) {
    if (typeof value === "string") {
      if (!value.startsWith("data:image/")) {
        return NextResponse.json({ error: `Nieprawidłowy format obrazu (${label})` }, { status: 400 });
      }
      if (approxBase64Bytes(value) > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: `Obraz (${label}) jest za duży (max 8 MB)` }, { status: 400 });
      }
    }
  }

  const patchBody: Record<string, unknown> = {};
  if (nick !== undefined) patchBody.nick = nick;
  if (bio !== undefined) patchBody.bio = bio;
  if (avatar !== undefined) patchBody.avatar = avatar;
  if (banner !== undefined) patchBody.banner = banner;

  const discordRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${creds.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patchBody),
  });

  if (!discordRes.ok) {
    const err = ((await discordRes.json().catch(() => ({}))) as Record<string, unknown>) ?? {};
    return NextResponse.json(
      { error: (err.message as string) ?? `Discord API error: ${discordRes.status}` },
      { status: discordRes.status >= 400 && discordRes.status < 500 ? discordRes.status : 502 }
    );
  }

  const updated: DiscordMemberProfile = await discordRes.json();

  await createAuditLog({
    guildId,
    userId: session.user.id || session.user.name || "unknown",
    username: session.user.name || session.user.email || "Unknown User",
    action: "settings.profile.update",
    module: "settings",
    description: "Zaktualizowano profil bota na tym serwerze",
    changes: [
      ...(nick !== undefined ? [{ field: "nick", label: "Nazwa bota", to: nick ?? "brak" }] : []),
      ...(bio !== undefined ? [{ field: "bio", label: "Opis bota", to: bio ?? "brak" }] : []),
      ...(avatar !== undefined
        ? [{ field: "avatar", label: "Avatar bota", to: avatar ? "zmieniono" : "usunięto" }]
        : []),
      ...(banner !== undefined
        ? [{ field: "banner", label: "Banner bota", to: banner ? "zmieniono" : "usunięto" }]
        : []),
    ],
  });

  return NextResponse.json({
    botUserId: creds.appId,
    nick: updated.nick ?? null,
    bio: updated.bio ?? null,
    ...buildUrls(guildId, creds.appId, updated),
  });
}
