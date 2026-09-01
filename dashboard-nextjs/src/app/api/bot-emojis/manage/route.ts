import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { OWNER_IDS } from "@/lib/owner";
import redis from "@/lib/redis";
import { getEmojiConfigMap } from "@/lib/botEmojiConfig";

export const dynamic = "force-dynamic";

const APP_EMOJIS_CACHE_KEY = "discord:app-emojis";
const APP_EMOJIS_CACHE_TTL = 60;
interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  managed: boolean;
  require_colons: boolean;
}

interface EnrichedEmoji extends DiscordEmoji {
  /** Ścieżka klucza w src/config/bot.ts (np. "faceit.levels.1") — null, gdy emoji nie jest wpięte w config bota. */
  key: string | null;
  group: string | null;
  groupLabel: string | null;
}

function enrichEmojis(emojis: DiscordEmoji[]): EnrichedEmoji[] {
  const configMap = getEmojiConfigMap(process.env.DISCORD_CLIENT_ID);
  return emojis.map((emoji) => {
    const entry = configMap.get(emoji.id);
    return {
      ...emoji,
      key: entry?.key ?? null,
      group: entry?.group ?? null,
      groupLabel: entry?.groupLabel ?? null,
    };
  });
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

function getAppCredentials(): { appId: string; botToken: string } | null {
  const appId = process.env.DISCORD_CLIENT_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !botToken) return null;
  return { appId, botToken };
}

export async function GET(request: NextRequest) {
  const guard = await ownerGuard(request);
  if (guard) return guard;

  const creds = getAppCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Bot credentials not configured" }, { status: 500 });
  }

  // Try short-lived Redis cache
  try {
    const cached = await redis.get(APP_EMOJIS_CACHE_KEY);
    if (cached) {
      const cachedEmojis = JSON.parse(cached) as DiscordEmoji[];
      return NextResponse.json(enrichEmojis(cachedEmojis));
    }
  } catch {
    // Redis unavailable — proceed to Discord API
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/applications/${creds.appId}/emojis`,
      {
        headers: { Authorization: `Bot ${creds.botToken}` },
        signal: controller.signal,
      }
    );
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

  // Application emojis endpoint returns { items: Emoji[] }
  const data = await response.json() as { items: DiscordEmoji[] };
  const emojis = data.items ?? [];

  try {
    await redis.setex(APP_EMOJIS_CACHE_KEY, APP_EMOJIS_CACHE_TTL, JSON.stringify(emojis));
  } catch {
    // Redis unavailable — skip caching
  }

  return NextResponse.json(enrichEmojis(emojis));
}

export async function POST(request: NextRequest) {
  const guard = await ownerGuard(request);
  if (guard) return guard;

  const creds = getAppCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Bot credentials not configured" }, { status: 500 });
  }

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
    !("image" in body)
  ) {
    return NextResponse.json({ error: "Missing name or image" }, { status: 400 });
  }

  const { name, image } = body as { name: string; image: string };

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

  const discordRes = await fetch(
    `https://discord.com/api/v10/applications/${creds.appId}/emojis`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${creds.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, image }),
    }
  );

  if (!discordRes.ok) {
    const err = await discordRes.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(
      { error: (err.message as string) ?? `Discord API error: ${discordRes.status}` },
      { status: discordRes.status >= 400 && discordRes.status < 500 ? discordRes.status : 502 }
    );
  }

  const emoji: DiscordEmoji = await discordRes.json();

  // Invalidate cache
  try {
    await redis.del(APP_EMOJIS_CACHE_KEY);
  } catch {
    // Redis unavailable — skip
  }

  return NextResponse.json(emoji, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const guard = await ownerGuard(request);
  if (guard) return guard;

  const creds = getAppCredentials();
  if (!creds) {
    return NextResponse.json({ error: "Bot credentials not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const emojiId = searchParams.get("id");
  if (!emojiId) {
    return NextResponse.json({ error: "Missing emoji id" }, { status: 400 });
  }

  // Zablokuj usunięcie emoji, które jest wpięte w config bota — usunięcie zepsułoby moduł, który się do niego odwołuje.
  const configMap = getEmojiConfigMap(process.env.DISCORD_CLIENT_ID);
  const configEntry = configMap.get(emojiId);
  if (configEntry) {
    return NextResponse.json(
      { error: `To emoji jest wpisane w config bota (${configEntry.key}) — usuń najpierw odwołanie w kodzie.` },
      { status: 409 }
    );
  }

  const discordRes = await fetch(
    `https://discord.com/api/v10/applications/${creds.appId}/emojis/${emojiId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bot ${creds.botToken}` },
    }
  );

  if (!discordRes.ok && discordRes.status !== 404) {
    const err = await discordRes.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(
      { error: (err.message as string) ?? `Discord API error: ${discordRes.status}` },
      { status: discordRes.status >= 400 && discordRes.status < 500 ? discordRes.status : 502 }
    );
  }

  // Invalidate cache
  try {
    await redis.del(APP_EMOJIS_CACHE_KEY);
  } catch {
    // Redis unavailable — skip
  }

  return NextResponse.json({ success: true });
}
