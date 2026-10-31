// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/owner", () => ({ OWNER_IDS: ["owner-1"] }));
vi.mock("@/lib/serverCache", () => ({
  getFromCache: vi.fn().mockResolvedValue(null),
  setInCache: vi.fn().mockResolvedValue(undefined),
}));

import { requireBotOwner } from "@/lib/requireBotOwner";
import { requireChannelsInGuild } from "@/lib/guildChannels";
import { parseJsonBody, snowflake, optionalSnowflake } from "@/lib/apiValidation";

const GUILD_CHANNEL = "111111111111111111";
const OTHER_GUILD_CHANNEL = "222222222222222222";

describe("requireBotOwner", () => {
  it("allows only the bot owner", () => {
    expect(requireBotOwner({ user: { id: "owner-1" }, expires: "" })).toBeNull();
    expect(requireBotOwner({ user: { id: "admin-of-some-server" }, expires: "" })?.status).toBe(403);
    expect(requireBotOwner(null)?.status).toBe(401);
  });
});

describe("requireChannelsInGuild", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: GUILD_CHANNEL, name: "general", type: 0, position: 0 }]), { status: 200 }))
    );
  });

  it("accepts channels of this server and empty values", async () => {
    expect(await requireChannelsInGuild("guild-1", [GUILD_CHANNEL, "", null, undefined])).toBeNull();
  });

  it("rejects a channel from another server", async () => {
    const res = await requireChannelsInGuild("guild-1", [OTHER_GUILD_CHANNEL]);
    expect(res?.status).toBe(400);
  });

  it("fails closed when Discord is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    const res = await requireChannelsInGuild("guild-1", [GUILD_CHANNEL]);
    expect(res?.status).toBe(502);
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ channelId: snowflake, roleId: optionalSnowflake });
  const request = (body: unknown) => new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });

  it("returns only whitelisted, typed fields", async () => {
    const result = await parseJsonBody(request({ channelId: GUILD_CHANNEL, roleId: "", isAdmin: true }), schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ channelId: GUILD_CHANNEL, roleId: "" });
  });

  it("rejects Mongo operators and wrong types with 400", async () => {
    const result = await parseJsonBody(request({ channelId: { $ne: null } }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    const result = await parseJsonBody(new Request("http://localhost", { method: "POST", body: "not json" }), schema);
    expect(result.ok).toBe(false);
  });
});
