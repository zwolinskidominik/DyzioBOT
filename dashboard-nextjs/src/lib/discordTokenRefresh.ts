import type { JWT } from "next-auth/jwt";

/**
 * Odświeżanie tokenu dostępu Discord OAuth2.
 *
 * Token Discorda wygasa po 7 dniach, a sesja NextAuth żyje 30 dni. Bez odświeżania po tygodniu
 * każde zapytanie do Discorda (np. lista serwerów) dostawało 401, a strona „Twoje serwery”
 * pokazywała „Brak dostępnych serwerów”, dopóki użytkownik się nie wylogował i nie zalogował.
 *
 * Discord przy odświeżeniu wydaje NOWY refresh token, a stary przestaje działać. Kilka zapytań
 * naraz (albo Server Components, które nie potrafią zapisać nowego ciasteczka sesji) mogłoby
 * próbować odświeżyć tym samym, już zużytym tokenem — dlatego wynik odświeżenia zapamiętujemy
 * dla starego refresh tokenu, aż nowy token dostępu wygaśnie.
 */

export const REFRESH_TOKEN_ERROR = "RefreshAccessTokenError";

/** Odśwież na minutę przed wygaśnięciem, żeby token nie wygasł w trakcie zapytania. */
const EXPIRY_MARGIN_MS = 60_000;

interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
}

const refreshes = new Map<string, Promise<RefreshedTokens | null>>();

function isTokenResponse(value: unknown): value is { access_token: string; refresh_token: string; expires_in: number } {
  if (!value || typeof value !== "object") return false;
  return (
    "access_token" in value && typeof value.access_token === "string" &&
    "refresh_token" in value && typeof value.refresh_token === "string" &&
    "expires_in" in value && typeof value.expires_in === "number"
  );
}

async function requestRefresh(refreshToken: string): Promise<RefreshedTokens | null> {
  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID ?? "",
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    console.error("Discord token refresh failed:", response.status);
    return null;
  }

  const payload: unknown = await response.json();
  if (!isTokenResponse(payload)) return null;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    accessTokenExpires: Date.now() + payload.expires_in * 1000,
  };
}

function refreshOnce(refreshToken: string): Promise<RefreshedTokens | null> {
  const existing = refreshes.get(refreshToken);
  if (existing) return existing;

  const promise = requestRefresh(refreshToken).catch((error: unknown) => {
    console.error("Discord token refresh error:", error);
    return null;
  });
  refreshes.set(refreshToken, promise);

  void promise.then((result) => {
    // Udane odświeżenie pamiętamy do wygaśnięcia nowego tokenu (patrz komentarz na górze),
    // nieudane od razu zapominamy, żeby kolejna próba mogła spróbować jeszcze raz.
    const ttl = result ? Math.max(0, result.accessTokenExpires - Date.now()) : 0;
    setTimeout(() => refreshes.delete(refreshToken), ttl).unref?.();
  });

  return promise;
}

export function isAccessTokenFresh(token: JWT, now = Date.now()): boolean {
  return typeof token.accessTokenExpires === "number" && now < token.accessTokenExpires - EXPIRY_MARGIN_MS;
}

/**
 * Zwraca token z ważnym tokenem dostępu: bez zmian, jeśli jeszcze nie wygasa, albo odświeżony.
 * Gdy odświeżenie się nie uda, ustawia `error`, żeby interfejs poprosił o ponowne logowanie.
 */
export async function ensureFreshDiscordToken(token: JWT): Promise<JWT> {
  if (isAccessTokenFresh(token)) return token;
  // Odświeżenie już raz się nie udało (refresh token cofnięty/zużyty) — nie odpytuj Discorda
  // przy każdym zapytaniu, tylko czekaj na ponowne logowanie.
  if (token.error === REFRESH_TOKEN_ERROR) return token;

  // Sesje sprzed wprowadzenia odświeżania nie mają refresh tokenu ani daty wygaśnięcia —
  // zostawiamy je bez zmian; gdy Discord odrzuci token, interfejs poprosi o ponowne logowanie.
  if (typeof token.refreshToken !== "string" || typeof token.accessTokenExpires !== "number") return token;

  const refreshed = await refreshOnce(token.refreshToken);
  if (!refreshed) return { ...token, error: REFRESH_TOKEN_ERROR };

  return { ...token, ...refreshed, error: undefined };
}
