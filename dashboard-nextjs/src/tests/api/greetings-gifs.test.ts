import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  gifStateFind: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));
vi.mock("@/lib/owner", () => ({ OWNER_IDS: ["owner"] }));

vi.mock("fs/promises", () => ({
  default: {
    readdir: mocks.readdir,
  },
  readdir: mocks.readdir,
}));

vi.mock("mongoose", () => {
  class Schema {
    constructor(_definition: unknown, _options?: unknown) {}
    index() {}
  }

  const GreetingGifState = {
    find: mocks.gifStateFind,
  };

  return {
    default: {
      connection: { readyState: 1 },
      connect: vi.fn(),
      Schema,
      models: {},
      model: vi.fn().mockReturnValue(GreetingGifState),
    },
  };
});

import { getServerSession } from "next-auth";
import { GET } from "@/app/api/guild/[guildId]/greetings/gifs/route";

function makeParams(guildId = "guild123") {
  return { params: Promise.resolve({ guildId }) };
}

function mockDisabledGifStates(fileNames: string[]) {
  mocks.gifStateFind.mockReturnValueOnce({
    select: vi.fn().mockReturnValueOnce({
      lean: vi.fn().mockResolvedValueOnce(fileNames.map((fileName) => ({ fileName }))),
    }),
  });
}

describe("GET /api/guild/[guildId]/greetings/gifs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "owner" }, accessToken: "token" } as Awaited<ReturnType<typeof getServerSession>>);
  });

  it("returns active GIFs first and disabled default GIFs at the end", async () => {
    mockDisabledGifStates(["hidden-default.gif"]);
    mocks.readdir
      .mockResolvedValueOnce(["default.gif", "hidden-default.gif", "readme.txt"])
      .mockResolvedValueOnce(["guild-upload.gif", "notes.txt"]);

    const response = await GET(new Request("http://localhost/api/guild/guild123/greetings/gifs"), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      {
        name: "default.gif",
        source: "default",
        disabled: false,
        url: "/api/guild/guild123/greetings/gifs/default.gif?source=default",
      },
      {
        name: "guild-upload.gif",
        source: "upload",
        disabled: false,
        url: "/api/guild/guild123/greetings/gifs/guild-upload.gif?source=upload",
      },
      {
        name: "hidden-default.gif",
        source: "default",
        disabled: true,
        url: "/api/guild/guild123/greetings/gifs/hidden-default.gif?source=default",
      },
    ]);
  });
});
