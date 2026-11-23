import { describe, it, expect, vi, beforeEach } from "vitest";

const readFile = vi.fn();
vi.mock("fs/promises", () => {
  const mocked = { readFile: (...args: unknown[]) => readFile(...args) };
  return { ...mocked, default: mocked };
});

import { GET } from "@/app/gz/[token]/route";

const TOKEN = "k7Qm2pXv9LrT4wZb8NcY1d";
const call = (token: string) => GET(new Request(`http://localhost/gz/${token}`), { params: Promise.resolve({ token }) });

describe("GET /gz/[token] (GameZone mod list)", () => {
  beforeEach(() => {
    readFile.mockReset().mockResolvedValue("<html>mods</html>");
    process.env.GAMEZONE_MODS_TOKEN = TOKEN;
  });

  it("serves the page for the right token, hidden from search engines", async () => {
    const res = await call(TOKEN);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>mods</html>");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("returns 404 for a wrong token, a token of another length and when no token is configured", async () => {
    expect((await call("k7Qm2pXv9LrT4wZb8NcY1x")).status).toBe(404);
    expect((await call("short")).status).toBe(404);
    delete process.env.GAMEZONE_MODS_TOKEN;
    expect((await call(TOKEN)).status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("returns 404 when the file is missing on the server", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    expect((await call(TOKEN)).status).toBe(404);
  });
});
