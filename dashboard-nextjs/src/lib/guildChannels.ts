import { NextResponse } from "next/server";
import { getFromCache, setInCache } from "./serverCache";
import { toSortedDiscordChannels } from "./discordOrdering";
import { getApiMessages } from "@/i18n/apiServer";

/**
 * Sprawdza, czy kanały wskazane w zapytaniu należą do serwera z URL-a.
 *
 * Panel wysyła wiadomości / kasuje kanały TOKENEM BOTA, a bot jest na wielu serwerach. Bez tej
 * kontroli administrator serwera A mógł podać ID kanału z serwera B i kazać botowi pisać tam
 * albo usunąć kanał (np. przez panel ról, ticketów czy kanały z licznikami).
 */

async function fetchChannelIds(guildId: string): Promise<Set<string> | null> {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const channels = toSortedDiscordChannels(await response.json());
  await setInCache("channels", guildId, channels);
  return new Set(channels.map((channel) => channel.id));
}

async function cachedChannelIds(guildId: string): Promise<Set<string> | null> {
  const cached = await getFromCache<unknown>("channels", guildId);
  if (!cached) return null;
  return new Set(toSortedDiscordChannels(cached).map((channel) => channel.id));
}

/** `null` gdy wszystkie podane kanały są na tym serwerze; inaczej gotowa odpowiedź błędu. */
export async function requireChannelsInGuild(
  guildId: string,
  channelIds: ReadonlyArray<string | null | undefined>
): Promise<NextResponse | null> {
  const wanted = channelIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (wanted.length === 0) return null;

  // Najpierw cache (szybko), a przy braku któregoś kanału świeża lista - kanał mógł właśnie powstać.
  let known = await cachedChannelIds(guildId);
  if (!known || wanted.some((id) => !known?.has(id))) {
    known = await fetchChannelIds(guildId);
  }

  const { t } = await getApiMessages();
  if (!known) {
    return NextResponse.json({ error: t.errors.guildAccessCheckFailed }, { status: 502 });
  }
  if (wanted.some((id) => !known?.has(id))) {
    return NextResponse.json({ error: t.errors.invalidData }, { status: 400 });
  }
  return null;
}
