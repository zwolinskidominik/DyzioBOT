import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Zmiana profilu bota (nick/opis/avatar/banner) jest na razie dostępna tylko na serwerach
// z PROFILE_EDIT_GUILD_IDS — blokada MUSI działać w API, nie tylko w UI.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));
vi.mock("@/lib/requireGuildAccess", () => ({ requireGuildAccess: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/auditLog", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/owner", () => ({ OWNER_IDS: ["u1"], PROFILE_EDIT_GUILD_IDS: ["owner-guild"] }));

import { getServerSession } from "next-auth";
import { GET, PATCH } from "@/app/api/guild/[guildId]/settings/profile/route";

const fetchMock = vi.fn();

function params(guildId: string) {
  return { params: Promise.resolve({ guildId }) };
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", name: "Owner" } } as never);
  process.env.DISCORD_CLIENT_ID = "bot-id";
  process.env.DISCORD_BOT_TOKEN = "token";
  // Nowa odpowiedź przy każdym wywołaniu — body Response da się odczytać tylko raz.
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ nick: "Deezy" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/guild/[guildId]/settings/profile", () => {
  it("refuses PATCH on servers outside the owner's list without calling Discord", async () => {
    const res = await PATCH(patchRequest({ nick: "Hacked" }), params("other-guild"));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows PATCH on the owner's servers", async () => {
    const res = await PATCH(patchRequest({ nick: "Dyzio" }), params("owner-guild"));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/guilds/owner-guild/members/@me",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("tells the UI whether the profile can be edited", async () => {
    const locked = await (await GET(new Request("http://localhost/x") as never, params("other-guild"))).json();
    const open = await (await GET(new Request("http://localhost/x") as never, params("owner-guild"))).json();
    expect(locked.editable).toBe(false);
    expect(open.editable).toBe(true);
  });
});
