// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { authOptions } from "@/lib/auth.config";
import { getDiscordAccessToken } from "@/lib/discordSessionToken";

function isAppSession(value: unknown): value is Session {
  return typeof value === "object" && value !== null && "user" in value && typeof value.user === "object" && value.user !== null && "id" in value.user;
}

describe("Discord access token stays on the server", () => {
  it("is readable on the server but missing from the session JSON sent to the browser", async () => {
    const sessionCallback = authOptions.callbacks?.session;
    if (!sessionCallback) throw new Error("session callback missing");

    const token: JWT = { id: "u1", accessToken: "secret-discord-token" };
    const base: Session = { user: { id: "" }, expires: "2099-01-01T00:00:00.000Z" };
    const result: unknown = await sessionCallback({
      session: base,
      token,
      user: { id: "u1", email: "", emailVerified: null },
      newSession: undefined,
      trigger: "update",
    });
    if (!isAppSession(result)) throw new Error("unexpected session shape");

    expect(result.user.id).toBe("u1");
    expect(getDiscordAccessToken(result)).toBe("secret-discord-token");
    expect(JSON.stringify(result)).not.toContain("secret-discord-token");
  });

  it("returns null without a session or token", () => {
    expect(getDiscordAccessToken(null)).toBeNull();
    expect(getDiscordAccessToken({ user: { id: "u1" }, expires: "2099-01-01T00:00:00.000Z" })).toBeNull();
  });
});

describe("getServerSession end to end", () => {
  it("keeps the token reachable through the real getServerSession (same session object)", async () => {
    const { encode } = await import("next-auth/jwt");
    const secret = "test-secret-for-session-token";
    process.env.NEXTAUTH_SECRET = secret;
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    const jwt = await encode({
      secret,
      token: { id: "u42", accessToken: "real-flow-token", accessTokenExpires: Date.now() + 3_600_000 },
    });

    const { getServerSession } = await import("next-auth");
    // Wariant (req, res, options): ten sam przepływ co w trasach API, bez kontekstu żądania Next.
    const req = { headers: { host: "localhost:3000" }, cookies: { "next-auth.session-token": jwt } };
    const res = { getHeader: () => undefined, setCookie: () => undefined, setHeader: () => undefined };
    const session = await getServerSession(req as never, res as never, authOptions);
    expect(session?.user.id).toBe("u42");
    expect(getDiscordAccessToken(session)).toBe("real-flow-token");
    expect(JSON.stringify(session)).not.toContain("real-flow-token");
  });
});
