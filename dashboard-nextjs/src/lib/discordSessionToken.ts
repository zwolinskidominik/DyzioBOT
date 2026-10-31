import type { Session } from "next-auth";

/**
 * Token Discorda użytkownika trzymamy POZA obiektem sesji.
 *
 * Wszystko, co zwraca callback `session` w NextAuth, trafia też do przeglądarki przez
 * `/api/auth/session` (useSession). Gdy token leżał w `session.accessToken`, każdy skrypt na stronie
 * (np. przy XSS) mógł go odczytać i działać na koncie Discord użytkownika w zakresie `guilds`.
 *
 * Callback `session` dopisuje token tutaj, w WeakMap przypiętej do tego samego obiektu sesji.
 * `getServerSession()` zwraca dokładnie ten obiekt, więc kod serwera odczyta token przez
 * `getDiscordAccessToken(session)`, a JSON wysyłany do przeglądarki go nie zawiera.
 */
const tokens = new WeakMap<Session, string>();

export function attachDiscordAccessToken(session: Session, accessToken: string | undefined): void {
  if (accessToken) tokens.set(session, accessToken);
}

/** Token Discorda dla sesji z `getServerSession()` albo `null` (brak sesji/tokenu). Tylko serwer. */
export function getDiscordAccessToken(session: Session | null | undefined): string | null {
  if (!session) return null;
  return tokens.get(session) ?? null;
}
