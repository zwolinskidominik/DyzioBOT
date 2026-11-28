import { describe, it, expect, vi, beforeEach } from "vitest";

const Fortune = vi.hoisted(() => ({
  find: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));
// Właściciel bota przechodzi requireGuildAccess bez odpytywania Discorda.
vi.mock("@/lib/owner", () => ({ OWNER_IDS: ["owner"] }));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn() }));
vi.mock("@/models/Fortune", () => ({ default: Fortune }));

import { getServerSession } from "next-auth";
import { testSession } from "@/tests/helpers/session";
import { GET, POST } from "@/app/api/guild/[guildId]/fortunes/route";

const params = { params: Promise.resolve({ guildId: "881293681783623680" }) };
const asUser = (id: string) => vi.mocked(getServerSession).mockResolvedValue(testSession(id));
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/x", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), {
    params: Promise.resolve({ guildId: "881293681783623680" }),
  });

describe("/api/guild/[guildId]/fortunes", () => {
  beforeEach(() => {
    Object.values(Fortune).forEach((fn) => fn.mockReset());
  });

  it("lists the pool for the bot owner", async () => {
    asUser("owner");
    Fortune.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([{ _id: "65a1b2c3d4e5f6a7b8c9d0e1", content: "Szczęście" }]) }) });
    const res = await GET(new Request("http://localhost/api/x"), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fortunes: [{ id: "65a1b2c3d4e5f6a7b8c9d0e1", content: "Szczęście" }], total: 1 });
  });

  it("refuses anyone who is not the bot owner", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await GET(new Request("http://localhost/api/x"), params)).status).toBe(401);
  });

  it("adds a normalized fortune and rejects duplicates and wrong lengths", async () => {
    asUser("owner");
    Fortune.exists.mockResolvedValue(null);
    Fortune.create.mockResolvedValue({ _id: "65a1b2c3d4e5f6a7b8c9d0e2" });
    const ok = await post({ action: "add", content: "  Jutro   będzie dobrze  " });
    expect(ok.status).toBe(200);
    expect(Fortune.create).toHaveBeenCalledWith({ content: "Jutro będzie dobrze", addedBy: "owner" });

    Fortune.exists.mockResolvedValue({ _id: "x" });
    expect((await post({ action: "add", content: "Jutro będzie dobrze" })).status).toBe(409);
    expect((await post({ action: "add", content: "ab" })).status).toBe(400);
    expect((await post({ action: "add", content: "x".repeat(501) })).status).toBe(400);
  });

  it("removes by id and validates the id format", async () => {
    asUser("owner");
    Fortune.deleteOne.mockResolvedValue({ deletedCount: 1 });
    expect((await post({ action: "remove", id: "65a1b2c3d4e5f6a7b8c9d0e1" })).status).toBe(200);
    Fortune.deleteOne.mockResolvedValue({ deletedCount: 0 });
    expect((await post({ action: "remove", id: "65a1b2c3d4e5f6a7b8c9d0e1" })).status).toBe(404);
    expect((await post({ action: "remove", id: "not-an-id" })).status).toBe(400);
    expect((await post({ action: "drop-table" })).status).toBe(400);
  });
});
