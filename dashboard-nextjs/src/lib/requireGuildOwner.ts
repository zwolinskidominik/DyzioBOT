import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getCachedGuildList, setCachedGuildList, type CachedDiscordGuild } from "./discordGuildCache";
import { fetchDiscordUserGuildsDeduped } from "./discordUserGuilds";

/**
 * Sprawdza, czy zalogowany użytkownik jest REALNYM właścicielem danego serwera
 * Discorda (pole `owner` z `GET /users/@me/guilds`) — nie administratorem,
 * nie właścicielem bota. Celowo BEZ bypassu przez `OWNER_IDS` (w przeciwieństwie
 * do `requireGuildAccess`): "Niebezpieczne funkcje" (reset poziomów/ekonomii/
 * ostrzeżeń) mają być dostępne WYŁĄCZNIE dla właściciela KONFIGUROWANEGO
 * serwera — to jawne wymaganie, nie przeoczenie.
 *
 * Użycie (bezpośrednio po standardowym sprawdzeniu sesji):
 *   const session = await getServerSession(authOptions);
 *   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   const { guildId } = await params;
 *   const ownerError = await requireGuildOwner(session, guildId);
 *   if (ownerError) return ownerError;
 */

const FRESH_CACHE_MS = 60_000;
const STALE_CACHE_MS = 30 * 60_000;

export async function requireGuildOwner(
  session: Session | null | undefined,
  guildId: string
): Promise<NextResponse | null> {
  const userId = session?.user?.id;
  const accessToken = session?.accessToken;

  if (!userId || !accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let guilds: CachedDiscordGuild[] | null = getCachedGuildList(userId, FRESH_CACHE_MS);

  if (!guilds) {
    const result = await fetchDiscordUserGuildsDeduped(userId, accessToken);

    if (result.ok) {
      guilds = result.guilds;
      setCachedGuildList(userId, result.guilds);
    } else {
      const stale = getCachedGuildList(userId, STALE_CACHE_MS);
      if (stale) {
        guilds = stale;
      } else {
        return NextResponse.json(
          { error: "Nie udało się zweryfikować własności serwera" },
          { status: 502 }
        );
      }
    }
  }

  const guild = guilds.find((g) => g.id === guildId);

  if (!guild || guild.owner !== true) {
    return NextResponse.json(
      { error: "Ta akcja jest dostępna tylko dla właściciela tego serwera Discord." },
      { status: 403 }
    );
  }

  return null;
}
