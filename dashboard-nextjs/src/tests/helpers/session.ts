import type { Session } from "next-auth";
import { attachDiscordAccessToken } from "@/lib/discordSessionToken";

/** Sesja jak z getServerSession(): token Discorda przypięty po stronie serwera, nie w obiekcie. */
export function testSession(userId: string, accessToken: string | null = "token", name?: string): Session {
  const session: Session = { user: { id: userId, ...(name ? { name } : {}) }, expires: "2099-01-01T00:00:00.000Z" };
  if (accessToken !== null) attachDiscordAccessToken(session, accessToken);
  return session;
}
