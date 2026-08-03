import redis from "@/lib/redis";

const APP_EMOJIS_CACHE_KEY = "discord:app-emojis";
const APP_EMOJIS_CACHE_TTL = 300; // 5 min

interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
}

/**
 * Zbiór ID Application Emojis bota (emoji, których bot może użyć jako
 * reakcji na dowolnym serwerze, niezależnie od tego, gdzie zostały wgrane).
 * Przy niedostępności Discord API / braku poświadczeń zwraca pusty Set —
 * fail-closed: każde custom emoji zostanie potem odrzucone przez
 * findInvalidCustomEmojis, standardowe (unicode) emoji nie są tym objęte.
 */
export async function getBotEmojiIds(): Promise<Set<string>> {
  try {
    const cached = await redis.get(APP_EMOJIS_CACHE_KEY);
    if (cached) {
      const emojis = JSON.parse(cached) as DiscordEmoji[];
      return new Set(emojis.map((e) => e.id));
    }
  } catch {
    // Redis unavailable — proceed to Discord API
  }

  const appId = process.env.DISCORD_CLIENT_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !botToken) return new Set();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/applications/${appId}/emojis`,
      { headers: { Authorization: `Bot ${botToken}` }, signal: controller.signal }
    );
  } catch {
    return new Set();
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) return new Set();

  const data = (await response.json()) as { items: DiscordEmoji[] };
  const emojis = data.items ?? [];

  try {
    await redis.setex(APP_EMOJIS_CACHE_KEY, APP_EMOJIS_CACHE_TTL, JSON.stringify(emojis));
  } catch {
    // Redis unavailable — skip caching
  }

  return new Set(emojis.map((e) => e.id));
}

/**
 * Zwraca podzbiór `reactions`, który są niedozwolonymi custom emoji Discorda
 * (`<a?:name:id>`, gdzie ID nie znajduje się w Application Emojis bota).
 * Standardowe emoji (unicode) zawsze przechodzą walidację.
 */
export function findInvalidCustomEmojis(reactions: string[], botEmojiIds: Set<string>): string[] {
  return reactions.filter((r) => {
    const m = r.match(/^<a?:(\w+):(\d+)>$/);
    return m !== null && !botEmojiIds.has(m[2]);
  });
}
