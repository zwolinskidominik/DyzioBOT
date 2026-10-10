import { beforeEach, describe, expect, it, vi } from "vitest";

const { findOne, dbConnect } = vi.hoisted(() => ({
  findOne: vi.fn(),
  dbConnect: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ default: dbConnect }));
vi.mock("@/models/BotStatus", () => ({
  default: { findOne },
  BOT_HEARTBEAT_STALE_MS: 90_000,
}));

import { evaluateHealth, getHealth, resetHealthCache } from "@/lib/health";
import { GET } from "@/app/api/health/route";

const NOW = Date.parse("2026-10-10T12:00:00Z");

function heartbeat(secondsAgo: number) {
  findOne.mockReturnValue({ lean: () => Promise.resolve({ ping: 50, updatedAt: new Date(Date.now() - secondsAgo * 1000) }) });
}

describe("evaluateHealth", () => {
  it("is ok when the database answers and the bot heartbeat is fresh", () => {
    const report = evaluateHealth({ databaseOk: true, botHeartbeatAt: new Date(NOW - 30_000), now: NOW });
    expect(report).toEqual({ status: "ok", components: { dashboard: "ok", database: "ok", bot: "ok" } });
  });

  it("marks the bot down when its heartbeat is older than 90 s or missing", () => {
    expect(evaluateHealth({ databaseOk: true, botHeartbeatAt: new Date(NOW - 91_000), now: NOW }).components.bot).toBe("down");
    expect(evaluateHealth({ databaseOk: true, botHeartbeatAt: null, now: NOW }).status).toBe("degraded");
  });

  it("marks database and bot down when the database does not answer", () => {
    const report = evaluateHealth({ databaseOk: false, botHeartbeatAt: null, now: NOW });
    expect(report.components).toEqual({ dashboard: "ok", database: "down", bot: "down" });
  });
});

describe("GET /api/health", () => {
  beforeEach(() => {
    resetHealthCache();
    findOne.mockReset();
    dbConnect.mockReset().mockResolvedValue(undefined);
  });

  it("returns 200 with only component states when everything works", async () => {
    heartbeat(10);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    // Publiczna odpowiedź nie zdradza nic poza stanami (bez pingu, wersji, błędów).
    expect(await res.json()).toEqual({ status: "ok", components: { dashboard: "ok", database: "ok", bot: "ok" } });
  });

  it("returns 503 when the bot stopped sending heartbeats", async () => {
    heartbeat(300);
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns 503 without error details when the database is unreachable", async () => {
    dbConnect.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:27017"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("ECONNREFUSED");
  });

  it("caches the result so a flood of requests does not hit the database", async () => {
    heartbeat(10);
    await Promise.all([getHealth(), getHealth(), getHealth()]);
    await getHealth();
    expect(findOne).toHaveBeenCalledTimes(1);
  });
});
