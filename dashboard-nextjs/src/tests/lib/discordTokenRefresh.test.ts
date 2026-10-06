import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import { ensureFreshDiscordToken, isAccessTokenFresh, REFRESH_TOKEN_ERROR } from "@/lib/discordTokenRefresh";

function tokenResponse(accessToken: string, refreshToken: string, expiresIn = 604800) {
  return new Response(
    JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, token_type: "Bearer" }),
    { status: 200 },
  );
}

describe("discordTokenRefresh", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a token that is not about to expire", async () => {
    const token: JWT = { accessToken: "a", refreshToken: "r", accessTokenExpires: Date.now() + 3_600_000 };
    expect(isAccessTokenFresh(token)).toBe(true);
    expect(await ensureFreshDiscordToken(token)).toBe(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and stores the rotated refresh token", async () => {
    fetchMock.mockResolvedValue(tokenResponse("new-access", "new-refresh"));
    const token: JWT = { id: "u1", accessToken: "old", refreshToken: "refresh-1", accessTokenExpires: Date.now() - 1000 };

    const result = await ensureFreshDiscordToken(token);

    expect(result).toMatchObject({ id: "u1", accessToken: "new-access", refreshToken: "new-refresh", error: undefined });
    expect(result.accessTokenExpires).toBeGreaterThan(Date.now());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/oauth2/token");
    expect(String((init as RequestInit).body)).toContain("grant_type=refresh_token");
    expect(String((init as RequestInit).body)).toContain("refresh_token=refresh-1");
  });

  it("refreshes only once when several requests use the same old refresh token", async () => {
    // Discord unieważnia stary refresh token po użyciu — drugie odświeżenie tym samym tokenem by się nie udało.
    fetchMock.mockResolvedValue(tokenResponse("shared-access", "shared-refresh"));
    const token: JWT = { accessToken: "old", refreshToken: "refresh-2", accessTokenExpires: Date.now() - 1000 };

    const [a, b] = await Promise.all([ensureFreshDiscordToken(token), ensureFreshDiscordToken(token)]);
    const c = await ensureFreshDiscordToken(token);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.accessToken).toBe("shared-access");
    expect(b.accessToken).toBe("shared-access");
    expect(c.accessToken).toBe("shared-access");
  });

  it("marks the session for re-login when Discord rejects the refresh", async () => {
    fetchMock.mockResolvedValue(new Response("invalid_grant", { status: 400 }));
    const token: JWT = { accessToken: "old", refreshToken: "refresh-3", accessTokenExpires: Date.now() - 1000 };

    const result = await ensureFreshDiscordToken(token);

    expect(result.error).toBe(REFRESH_TOKEN_ERROR);
    expect(result.accessToken).toBe("old");
  });

  it("leaves sessions created before refresh support untouched", async () => {
    const legacy: JWT = { id: "u1", accessToken: "legacy" };
    expect(await ensureFreshDiscordToken(legacy)).toBe(legacy);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
