import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { OWNER_IDS } from "./owner";
import { getCachedGuildList, setCachedGuildList, type CachedDiscordGuild } from "./discordGuildCache";
import { fetchDiscordUserGuildsDeduped } from "./discordUserGuilds";

/**
 * Sprawdza, czy zalogowany użytkownik ma prawo zarządzać DANYM serwerem
 * (guildId z URL-a) — nie tylko czy jest w ogóle zalogowany.
 *
 * Bez tego każdy zalogowany użytkownik dashboardu mógł odczytać/zmienić dane
 * DOWOLNEGO serwera bota, znając/zgadując jego Discord guildId (IDOR) — trasy
 * API sprawdzały tylko `getServerSession`, nigdy dostępu do konkretnego
 * guildId. Ten helper to naprawia: pobiera listę serwerów użytkownika z
 * Discord API (`GET /users/@me/guilds`, z cache współdzielonym z
 * `/api/discord/guild/[guildId]`), znajduje w niej ten guildId i sprawdza bit
 * uprawnień MANAGE_GUILD / ADMINISTRATOR. Właściciel bota (`OWNER_IDS`) ma
 * zawsze dostęp — administruje wszystkimi serwerami bota niezależnie od tego,
 * czy technicznie ma na danym serwerze uprawnienie Manage Server.
 *
 * Użycie (bezpośrednio po standardowym sprawdzeniu sesji):
 *   const session = await getServerSession(authOptions);
 *   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   const { guildId } = await params;
 *   const accessError = await requireGuildAccess(session, guildId);
 *   if (accessError) return accessError;
 */

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

const FRESH_CACHE_MS = 60_000;
const STALE_CACHE_MS = 30 * 60_000;

function hasManageAccess(permissions: string): boolean {
  try {
    const bits = BigInt(permissions);
    return (bits & MANAGE_GUILD) === MANAGE_GUILD || (bits & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}

export async function requireGuildAccess(
  session: Session | null | undefined,
  guildId: string
): Promise<NextResponse | null> {
  const userId = session?.user?.id;
  const accessToken = session?.accessToken;

  if (!userId || !accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Właściciel bota ma dostęp do wszystkiego — spójne z resztą kodu (moduły
  // owner-only w disboard/tournament/wrapped używają tego samego allowlisty).
  if (OWNER_IDS.includes(userId)) {
    return null;
  }

  let guilds: CachedDiscordGuild[] | null = getCachedGuildList(userId, FRESH_CACHE_MS);

  if (!guilds) {
    const result = await fetchDiscordUserGuildsDeduped(userId, accessToken);

    if (result.ok) {
      guilds = result.guilds;
      setCachedGuildList(userId, result.guilds);
    } else {
      // Discord API niedostępne/rate-limited — spróbuj starszego cache zamiast
      // twardo blokować użytkownika, ale NIE otwieraj dostępu bez żadnej
      // weryfikacji (fail-closed, nie fail-open).
      const stale = getCachedGuildList(userId, STALE_CACHE_MS);
      if (stale) {
        guilds = stale;
      } else {
        return NextResponse.json(
          { error: "Nie udało się zweryfikować dostępu do serwera" },
          { status: 502 }
        );
      }
    }
  }

  const guild = guilds.find((g) => g.id === guildId);

  if (!guild || !hasManageAccess(guild.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
