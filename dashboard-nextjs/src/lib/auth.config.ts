import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
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
        token.accessToken = account.access_token;
        token.id = (profile as any)?.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.accessToken = token.accessToken as string;
      }
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
