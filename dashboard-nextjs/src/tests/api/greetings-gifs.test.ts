import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  gifStateFind: vi.fn(),
  gifStateDeleteOne: vi.fn(),
  gifStateFindOneAndUpdate: vi.fn(),
  gifStateDeleteMany: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));
vi.mock("@/lib/owner", () => ({ OWNER_IDS: ["owner"] }));

vi.mock("fs/promises", () => ({
  default: {
    readdir: mocks.readdir,
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
    unlink: mocks.unlink,
  },
  readdir: mocks.readdir,
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
  unlink: mocks.unlink,
}));

vi.mock("mongoose", () => {
  class Schema {
    constructor(_definition: unknown, _options?: unknown) {}
    index() {}
  }

  const GreetingGifState = {
    find: mocks.gifStateFind,
    deleteOne: mocks.gifStateDeleteOne,
    findOneAndUpdate: mocks.gifStateFindOneAndUpdate,
    deleteMany: mocks.gifStateDeleteMany,
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
import { DELETE, GET, PATCH, POST } from "@/app/api/guild/[guildId]/greetings/gifs/route";

function makeParams(guildId = "guild123") {
  return { params: Promise.resolve({ guildId }) };
}

function makeGifUploadRequest(fileName = "welcome.gif") {
  const formData = new FormData();
  formData.append("gif", new Blob([new Uint8Array([1])], { type: "image/gif" }), fileName);

  return new Request("http://localhost/api/guild/guild123/greetings/gifs", {
    method: "POST",
    body: formData,
  });
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
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user123" } } as Awaited<ReturnType<typeof getServerSession>>);
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

describe("PATCH /api/guild/[guildId]/greetings/gifs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user123" } } as Awaited<ReturnType<typeof getServerSession>>);
  });

  it("hides a default GIF for the current guild", async () => {
    mocks.gifStateFindOneAndUpdate.mockResolvedValueOnce({});

    const response = await PATCH(
      new Request("http://localhost/api/guild/guild123/greetings/gifs?name=default.gif&source=default", {
        method: "PATCH",
        body: JSON.stringify({ disabled: true }),
      }),
      makeParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      mode: "hidden",
      gif: {
        name: "default.gif",
        source: "default",
        disabled: true,
        url: "/api/guild/guild123/greetings/gifs/default.gif?source=default",
      },
    });
    expect(mocks.gifStateFindOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild123", fileName: "default.gif" },
      expect.objectContaining({ disabled: true, disabledBy: "user123" }),
      { upsert: true, new: true }
    );
  });

  it("restores a default GIF by removing the guild state", async () => {
    mocks.gifStateDeleteOne.mockResolvedValueOnce({ deletedCount: 1 });

    const response = await PATCH(
      new Request("http://localhost/api/guild/guild123/greetings/gifs?name=default.gif&source=default", {
        method: "PATCH",
        body: JSON.stringify({ disabled: false }),
      }),
      makeParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      mode: "restored",
      gif: {
        name: "default.gif",
        source: "default",
        disabled: false,
        url: "/api/guild/guild123/greetings/gifs/default.gif?source=default",
      },
    });
    expect(mocks.gifStateDeleteOne).toHaveBeenCalledWith({ guildId: "guild123", fileName: "default.gif" });
  });
});

describe("POST /api/guild/[guildId]/greetings/gifs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user123" } } as Awaited<ReturnType<typeof getServerSession>>);
  });

  it("returns 409 when the guild already has 5 uploaded GIFs", async () => {
    mocks.readdir.mockResolvedValueOnce(["1.gif", "2.gif", "3.gif", "4.gif", "5.gif"]);

    const response = await POST(makeGifUploadRequest(), makeParams());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "GIF_LIMIT_REACHED", max: 5 });
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.gifStateDeleteOne).not.toHaveBeenCalled();
  });

  it("uploads a GIF when the guild is below the upload limit", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234567890);
    mocks.readdir.mockResolvedValueOnce(["1.gif", "2.gif", "3.gif", "4.gif"]);
    mocks.mkdir.mockResolvedValueOnce(undefined);
    mocks.writeFile.mockResolvedValueOnce(undefined);
    mocks.gifStateDeleteOne.mockResolvedValueOnce({ deletedCount: 0 });

    const response = await POST(makeGifUploadRequest("welcome party.gif"), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      name: "1234567890-blob.gif",
      source: "upload",
      url: "/api/guild/guild123/greetings/gifs/1234567890-blob.gif?source=upload",
    });
    expect(mocks.mkdir).toHaveBeenCalledWith(expect.stringContaining("guild123"), { recursive: true });
    expect(mocks.writeFile).toHaveBeenCalledOnce();
    expect(mocks.gifStateDeleteOne).toHaveBeenCalledWith({
      guildId: "guild123",
      fileName: "1234567890-blob.gif",
    });
  });
});

describe("DELETE /api/guild/[guildId]/greetings/gifs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user123" } } as Awaited<ReturnType<typeof getServerSession>>);
  });

  it("soft-hides default GIFs for the current guild", async () => {
    mocks.gifStateFindOneAndUpdate.mockResolvedValueOnce({});

    const response = await DELETE(
      new Request("http://localhost/api/guild/guild123/greetings/gifs?name=default.gif&source=default", { method: "DELETE" }),
      makeParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, mode: "soft" });
    expect(mocks.unlink).not.toHaveBeenCalled();
    expect(mocks.gifStateFindOneAndUpdate).toHaveBeenCalledWith(
      { guildId: "guild123", fileName: "default.gif" },
      expect.objectContaining({ disabled: true, disabledBy: "user123" }),
      { upsert: true, new: true }
    );
  });

  it("hard-deletes uploaded GIFs from the current guild directory", async () => {
    mocks.unlink.mockResolvedValueOnce(undefined);
    mocks.gifStateDeleteOne.mockResolvedValueOnce({ deletedCount: 0 });

    const response = await DELETE(
      new Request("http://localhost/api/guild/guild123/greetings/gifs?name=upload.gif&source=upload", { method: "DELETE" }),
      makeParams()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, mode: "hard" });
    expect(mocks.unlink).toHaveBeenCalledWith(expect.stringContaining("guild123"));
    expect(mocks.gifStateDeleteOne).toHaveBeenCalledWith({ guildId: "guild123", fileName: "upload.gif" });
  });
});