import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Lista serwerów użytkownika na /guilds: po dodaniu bota kafelek ma od razu przestać
// pokazywać „Dodaj bota”, mimo 60-sekundowego cache listy.

const mocks = vi.hoisted(() => ({
  fetchUserGuilds: vi.fn(),
  redisGet: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));
vi.mock("@/lib/discordUserGuilds", () => ({ fetchDiscordUserGuildsDeduped: mocks.fetchUserGuilds }));
vi.mock("@/lib/redis", () => ({
  default: {
    get: mocks.redisGet,
    pipeline: () => ({ setex() { return this; }, exec: async () => [] }),
  },
}));

import { getServerSession } from "next-auth";
import { GET } from "@/app/api/discord/guilds/route";

const ADMIN = String(0x8);
const fetchMock = vi.fn();

function botGuilds(ids: string[]) {
  return async () => new Response(JSON.stringify(ids.map((id) => ({ id }))), { status: 200 });
}

let userCounter = 0;

beforeEach(() => {
  userCounter += 1;
  // Osobny użytkownik na test — cache w pamięci jest per użytkownik i żyje między testami.
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: `user-${userCounter}` }, accessToken: "tok" } as never);
  mocks.redisGet.mockResolvedValue(null);
  mocks.fetchUserGuilds.mockResolvedValue({
    ok: true,
    guilds: [{ id: "g1", name: "Mój serwer", icon: null, owner: true, permissions: ADMIN }],
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("GET /api/discord/guilds", () => {
  it("?fresh=1 re-checks where the bot is, even when the list is cached", async () => {
    fetchMock.mockImplementation(botGuilds([]));
    const before = await (await GET(new NextRequest("http://localhost/api/discord/guilds"))).json();
    expect(before[0].hasBot).toBe(false);

    // Bot właśnie dodany — zwykłe odświeżenie trafiłoby w cache.
    fetchMock.mockImplementation(botGuilds(["g1"]));
    const after = await (await GET(new NextRequest("http://localhost/api/discord/guilds?fresh=1"))).json();
    expect(after[0].hasBot).toBe(true);
    expect(mocks.fetchUserGuilds).toHaveBeenCalledTimes(1);
  });

  it("does not claim the bot is missing (or cache that) when Discord fails to list the bot's servers", async () => {
    fetchMock.mockImplementation(async () => new Response("rate limited", { status: 429 }));
    const first = await (await GET(new NextRequest("http://localhost/api/discord/guilds"))).json();
    expect(first[0].hasBot).toBeUndefined();

    fetchMock.mockImplementation(botGuilds(["g1"]));
    const second = await (await GET(new NextRequest("http://localhost/api/discord/guilds"))).json();
    expect(second[0].hasBot).toBe(true);
  });
});
