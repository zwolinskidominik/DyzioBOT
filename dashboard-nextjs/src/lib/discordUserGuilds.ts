/**
 * Deduplikowane pobieranie `GET /users/@me/guilds` z Discord API.
 *
 * Kontekst: Sidebar (`/api/discord/guilds`) i GuildAvailabilityGuard
 * (`/api/discord/guild/[guildId]`) niezależnie odpytywały ten sam endpoint
 * Discorda tym samym tokenem użytkownika przy każdym montowaniu strony.
 * Po restarcie/rekompilacji dev servera oba moduły miały puste cache
 * w pamięci procesu, więc obie strony strzelały żywym zapytaniem niemal
 * w tej samej chwili — Discord odpowiadał 429 na jedno z nich.
 *
 * Ten moduł trzyma jedną wspólną, w locie (in-flight) obietnicę na
 * użytkownika, więc niezależnie ile miejsc w aplikacji poprosi o listę
 * gildii w tym samym momencie, do Discorda poleci tylko jedno zapytanie.
 */

export interface DiscordGuildSummary {
  id: string;
  name: string;
  icon: string | null;
  permissions: string;
  /** Czy zalogowany user jest właścicielem TEGO serwera Discorda (pole natywnie zwracane przez /users/@me/guilds). */
  owner: boolean;
}

export interface DiscordUserGuildsResult {
  ok: boolean;
  status: number;
  retryAfter: string | null;
  guilds: DiscordGuildSummary[];
  errorText?: string;
}

const inflight = new Map<string, Promise<DiscordUserGuildsResult>>();

function isDiscordGuildSummary(value: unknown): value is DiscordGuildSummary {
  if (!value || typeof value !== "object") return false;
  return (
    "id" in value && typeof value.id === "string" &&
    "name" in value && typeof value.name === "string" &&
    "permissions" in value && typeof value.permissions === "string" &&
    "icon" in value && (typeof value.icon === "string" || value.icon === null) &&
    "owner" in value && typeof value.owner === "boolean"
  );
}

export function fetchDiscordUserGuildsDeduped(
  userId: string,
  accessToken: string
): Promise<DiscordUserGuildsResult> {
  const existing = inflight.get(userId);
  if (existing) return existing;

  const promise = (async (): Promise<DiscordUserGuildsResult> => {
    try {
      const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30000),
      });

      const retryAfter = response.headers.get("retry-after");

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return { ok: false, status: response.status, retryAfter, guilds: [], errorText };
      }

      const payload: unknown = await response.json();
      const guilds = Array.isArray(payload) ? payload.filter(isDiscordGuildSummary) : [];
      return { ok: true, status: response.status, retryAfter: null, guilds };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        retryAfter: null,
        guilds: [],
        errorText: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  inflight.set(userId, promise);
  void promise.finally(() => {
    inflight.delete(userId);
  });

  return promise;
}
