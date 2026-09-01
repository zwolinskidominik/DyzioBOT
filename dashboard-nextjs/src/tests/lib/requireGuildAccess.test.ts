import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/owner", () => ({ OWNER_IDS: ["owner-1"] }));

import { requireGuildAccess } from "@/lib/requireGuildAccess";
import { setCachedGuildList } from "@/lib/discordGuildCache";
import type { Session } from "next-auth";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function session(userId: string, accessToken = "token"): Session {
  return { user: { id: userId }, accessToken } as Session;
}

describe("requireGuildAccess", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks with 401 when there is no session", async () => {
    const res = await requireGuildAccess(null, "guild-1");
    expect(res?.status).toBe(401);
  });

  it("blocks with 401 when session has no accessToken", async () => {
    const res = await requireGuildAccess({ user: { id: "u1" } } as Session, "guild-1");
    expect(res?.status).toBe(401);
  });

  it("lets the bot owner through for ANY guildId without hitting Discord", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await requireGuildAccess(session("owner-1"), "some-random-unowned-guild");

    expect(res).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a logged-in user who is not a member of the guild (IDOR case)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([{ id: "other-guild", name: "Not this one", icon: null, permissions: "2147483647" }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await requireGuildAccess(session("regular-user-1"), "victim-guild");

    expect(res?.status).toBe(403);
  });

  it("blocks a guild member who lacks MANAGE_GUILD / ADMINISTRATOR", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      // permissions "1024" = VIEW_CHANNEL only, no MANAGE_GUILD(0x20) / ADMINISTRATOR(0x8)
      jsonResponse([{ id: "victim-guild", name: "Some server", icon: null, permissions: "1024" }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await requireGuildAccess(session("regular-user-2"), "victim-guild");

    expect(res?.status).toBe(403);
  });

  it("allows a member with MANAGE_GUILD permission", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([{ id: "my-guild", name: "My server", icon: null, permissions: String(0x20) }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await requireGuildAccess(session("regular-user-3"), "my-guild");

    expect(res).toBeNull();
  });

  it("allows a member with ADMINISTRATOR permission", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([{ id: "my-guild", name: "My server", icon: null, permissions: String(0x8) }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await requireGuildAccess(session("regular-user-4"), "my-guild");

    expect(res).toBeNull();
  });

  it("reuses the fresh guild-list cache instead of hitting Discord again", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setCachedGuildList("regular-user-5", [
      { id: "cached-guild", name: "Cached", icon: null, permissions: String(0x20) },
    ]);

    const res = await requireGuildAccess(session("regular-user-5"), "cached-guild");

    expect(res).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed (502) when Discord is unreachable and there is no cache to fall back to", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await requireGuildAccess(session("regular-user-6"), "some-guild");

    expect(res?.status).toBe(502);
  });
});
