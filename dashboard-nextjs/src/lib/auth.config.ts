import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { ensureFreshDiscordToken } from "@/lib/discordTokenRefresh";

function profileId(profile: unknown): string | undefined {
  if (profile && typeof profile === "object" && "id" in profile && typeof profile.id === "string") {
    return profile.id;
  }
  return undefined;
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // Discord dołącza do przekierowania po logowaniu parametr `iss` (RFC 9207). openid-client
      // sprawdza go wtedy z wydawcą dostawcy — bez skonfigurowanego wydawcy każde logowanie
      // kończyło się błędem „issuer must be configured on the issuer” (error=OAuthCallback).
      issuer: process.env.DISCORD_OAUTH_ISSUER ?? "https://discord.com",
      authorization: {
        params: {
          scope: "identify guilds guilds.members.read",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        // Pierwsze logowanie: zapamiętujemy też refresh token i moment wygaśnięcia, żeby móc
        // odświeżyć token Discorda (wygasa po 7 dniach, sesja trwa 30).
        return {
          ...token,
          id: profileId(profile),
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: typeof account.expires_at === "number" ? account.expires_at * 1000 : undefined,
          error: undefined,
        };
      }
      return ensureFreshDiscordToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.accessToken = token.accessToken ?? "";
      }
      session.error = token.error;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Reject protocol-relative URLs (//domain) — open redirect protection
      if (url.startsWith("//")) return `${baseUrl}/guilds`;
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/guilds`;
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        return `${baseUrl}/guilds`;
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
  // State and PKCE cookies: SameSite=Lax is correct for direct VPS setup
  // (no Cloudflare proxy). Top-level OAuth redirects send Lax cookies fine.
  // Secure=true enforced via __Secure- prefix (NEXTAUTH_URL=https://).
  cookies: {
    state: {
      name: "__Secure-next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
        maxAge: 900,
      },
    },
    pkceCodeVerifier: {
      name: "__Secure-next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
        maxAge: 900,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
