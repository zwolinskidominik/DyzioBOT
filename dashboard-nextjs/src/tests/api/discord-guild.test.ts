import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { GET } from "@/app/api/discord/guild/[guildId]/route";
import { setCachedGuildList } from "@/lib/discordGuildCache";

function makeParams(guildId = "guild123") {
  return { params: Promise.resolve({ guildId }) };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("GET /api/discord/guild/[guildId]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user123" },
      accessToken: "user-token",
    });
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/api/discord/guild/guild123"), makeParams());

    expect(res.status).toBe(401);
  });

  it("returns hasBot false when the bot is no longer in the guild", async () => {
    const guildId = "guild-no-bot";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        { id: guildId, name: "Testowy serwer", icon: null, permissions: "8" },
      ]))
      .mockResolvedValueOnce(jsonResponse({ message: "Unknown Guild" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request(`http://localhost/api/discord/guild/${guildId}`), makeParams(guildId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: guildId, name: "Testowy serwer", hasBot: false });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reuses the fresh guild list cache before calling Discord again", async () => {
    const guildId = "guild-from-list-cache";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setCachedGuildList("user123", [
      { id: guildId, name: "Cached server", icon: null, permissions: "8", hasBot: true },
    ]);

    const res = await GET(new Request(`http://localhost/api/discord/guild/${guildId}`), makeParams(guildId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Deezy-Cache")).toBe("guild-list");
    expect(body).toMatchObject({ id: guildId, name: "Cached server", hasBot: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("force refresh detects a removed bot despite a fresh cached value", async () => {
    const guildId = "guild-force-refresh";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        { id: guildId, name: "Testowy serwer", icon: null, permissions: "8" },
      ]))
      .mockResolvedValueOnce(jsonResponse({ id: guildId }))
      .mockResolvedValueOnce(jsonResponse([
        { id: guildId, name: "Testowy serwer", icon: null, permissions: "8" },
      ]))
      .mockResolvedValueOnce(jsonResponse({ message: "Unknown Guild" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const first = await GET(new Request(`http://localhost/api/discord/guild/${guildId}`), makeParams(guildId));
    const second = await GET(new Request(`http://localhost/api/discord/guild/${guildId}?force=1`), makeParams(guildId));

    expect((await first.json()).hasBot).toBe(true);
    expect((await second.json()).hasBot).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("serves stale availability on Discord 429 instead of blocking the dashboard", async () => {
    const guildId = "guild-stale-on-429";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        { id: guildId, name: "Testowy serwer", icon: null, permissions: "8" },
      ]))
      .mockResolvedValueOnce(jsonResponse({ id: guildId }))
      .mockResolvedValueOnce(jsonResponse({ message: "Rate limited" }, 429));
    vi.stubGlobal("fetch", fetchMock);

    await GET(new Request(`http://localhost/api/discord/guild/${guildId}`), makeParams(guildId));
    const res = await GET(new Request(`http://localhost/api/discord/guild/${guildId}?force=1`), makeParams(guildId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Deezy-Cache")).toBe("stale");
    expect(body).toMatchObject({ id: guildId, hasBot: true });
    consoleErrorSpy.mockRestore();
  });

  it("returns a transient 503 when bot presence is rate limited and no stale cache exists", async () => {
    const guildId = "guild-bot-presence-429";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        { id: guildId, name: "Testowy serwer", icon: null, permissions: "8" },
      ]))
      .mockResolvedValueOnce(jsonResponse({ message: "Rate limited" }, 429));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request(`http://localhost/api/discord/guild/${guildId}?force=1`), makeParams(guildId));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({ transient: true });
    expect(res.headers.get("Retry-After")).toBe("1");
  });

  it("returns 404 when the user no longer has access to the guild", async () => {
    const guildId = "guild-no-access";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse([])));

    const res = await GET(new Request(`http://localhost/api/discord/guild/${guildId}`), makeParams(guildId));

    expect(res.status).toBe(404);
  });
});
