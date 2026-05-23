import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { OWNER_IDS, OWNER_GUILD_IDS } from "@/lib/owner";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

const BOT_EMOJIS_CACHE_KEY = "discord:bot-emojis";
const GUILD_EMOJIS_CACHE_PREFIX = "discord:guild-emojis:";
const GUILD_EMOJIS_CACHE_TTL = 60; // 60s — short TTL, management page needs fresh data

interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  managed: boolean;
  require_colons: boolean;
}

async function ownerGuard(request: NextRequest): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string })?.id;
  if (!userId || !OWNER_IDS.includes(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function isOwnerGuild(guildId: string): boolean {
  return (OWNER_GUILD_IDS as readonly string[]).includes(guildId);
}

export async function GET(request: NextRequest) {
  const guard = await ownerGuard(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guildId");

  if (!guildId || !isOwnerGuild(guildId)) {
    return NextResponse.json({ error: "Invalid guild" }, { status: 400 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }

  // Try short-lived Redis cache
  const cacheKey = `${GUILD_EMOJIS_CACHE_PREFIX}${guildId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return NextResponse.json(JSON.parse(cached));
  } catch {
    // Redis unavailable — proceed to Discord API
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/emojis`, {
      headers: { Authorization: `Bot ${botToken}` },
      signal: controller.signal,
    });
  } catch {
    return NextResponse.json({ error: "Discord API unreachable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: `Discord API error: ${response.status}` },
      { status: 502 }
    );
  }

  const emojis: DiscordEmoji[] = await response.json();

  try {
    await redis.setex(cacheKey, GUILD_EMOJIS_CACHE_TTL, JSON.stringify(emojis));
  } catch {
    // Redis unavailable — skip caching
  }

  return NextResponse.json(emojis);
}

export async function POST(request: NextRequest) {
  const guard = await ownerGuard(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("name" in body) ||
    !("image" in body) ||
    !("guildId" in body)
  ) {
    return NextResponse.json({ error: "Missing name, image or guildId" }, { status: 400 });
  }

  const { name, image, guildId } = body as { name: string; image: string; guildId: string };

  if (!isOwnerGuild(guildId)) {
    return NextResponse.json({ error: "Invalid guild" }, { status: 400 });
  }

  // Discord emoji name: 2–32 alphanumeric + underscores
  if (typeof name !== "string" || !/^[a-zA-Z0-9_]{2,32}$/.test(name)) {
    return NextResponse.json(
      { error: "Nazwa musi mieć 2–32 znaki: litery, cyfry i podkreślenie (_)" },
      { status: 400 }
    );
  }

  // Must be a valid data URI
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "Nieprawidłowy format obrazu" }, { status: 400 });
  }

  // Approximate size check (~256 KB limit for Discord)
  const base64Part = image.split(",")[1] ?? "";
  const approxBytes = Math.ceil((base64Part.length * 3) / 4);
  if (approxBytes > 262144) {
    return NextResponse.json({ error: "Obraz jest za duży (max 256 KB)" }, { status: 400 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }

  const discordRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/emojis`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, image }),
  });

  if (!discordRes.ok) {
    const err = await discordRes.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(
      { error: (err.message as string) ?? `Discord API error: ${discordRes.status}` },
      { status: discordRes.status >= 400 && discordRes.status < 500 ? discordRes.status : 502 }
    );
  }

  const emoji: DiscordEmoji = await discordRes.json();

  // Invalidate caches
  try {
    await redis.del(`${GUILD_EMOJIS_CACHE_PREFIX}${guildId}`);
    await redis.del(BOT_EMOJIS_CACHE_KEY);
  } catch {
    // Redis unavailable — skip
  }

  return NextResponse.json(emoji, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const guard = await ownerGuard(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const emojiId = searchParams.get("emojiId");
  const guildId = searchParams.get("guildId");

  if (!emojiId || !guildId) {
    return NextResponse.json({ error: "Missing emojiId or guildId" }, { status: 400 });
  }

  if (!isOwnerGuild(guildId)) {
    return NextResponse.json({ error: "Invalid guild" }, { status: 400 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
  }

  const discordRes = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/emojis/${emojiId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bot ${botToken}` },
    }
  );

  if (!discordRes.ok && discordRes.status !== 204) {
    return NextResponse.json(
      { error: `Discord API error: ${discordRes.status}` },
      { status: 502 }
    );
  }

  // Invalidate caches
  try {
    await redis.del(`${GUILD_EMOJIS_CACHE_PREFIX}${guildId}`);
    await redis.del(BOT_EMOJIS_CACHE_KEY);
  } catch {
    // Redis unavailable — skip
  }

  return new NextResponse(null, { status: 204 });
}
