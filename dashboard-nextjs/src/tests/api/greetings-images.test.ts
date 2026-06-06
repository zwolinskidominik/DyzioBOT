import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
  },
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
}));

import { getServerSession } from "next-auth";
import { POST } from "@/app/api/guild/[guildId]/greetings/images/route";

function makeParams(guildId = "guild123") {
  return { params: Promise.resolve({ guildId }) };
}

function makeImageUploadRequest(slot: string, fileName = "image.png", type = "image/png") {
  const formData = new FormData();
  formData.append("slot", slot);
  formData.append("image", new Blob([new Uint8Array([1])], { type }), fileName);

  return new Request("http://localhost/api/guild/guild123/greetings/images", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/guild/[guildId]/greetings/images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user123" } } as Awaited<ReturnType<typeof getServerSession>>);
  });

  it("uploads a thumbnail image for the current guild", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234567890);
    mocks.mkdir.mockResolvedValueOnce(undefined);
    mocks.writeFile.mockResolvedValueOnce(undefined);

    const response = await POST(makeImageUploadRequest("thumbnail"), makeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      slot: "thumbnail",
      fileName: expect.stringMatching(/^1234567890-.+\.png$/),
      url: expect.stringContaining("/api/guild/guild123/greetings/images/"),
    });
    expect(mocks.mkdir).toHaveBeenCalledWith(expect.stringContaining("guild123"), { recursive: true });
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringContaining("guild123"), expect.any(Buffer));
  });

  it("uploads header and footer icons for the current guild", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234567891);
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);

    const headerResponse = await POST(makeImageUploadRequest("headerIcon", "header.png"), makeParams());
    const footerResponse = await POST(makeImageUploadRequest("footerIcon", "footer.png"), makeParams());
    const headerBody = await headerResponse.json();
    const footerBody = await footerResponse.json();

    expect(headerResponse.status).toBe(200);
    expect(footerResponse.status).toBe(200);
    expect(headerBody).toEqual({
      slot: "headerIcon",
      fileName: expect.stringMatching(/^1234567891-.+\.png$/),
      url: expect.stringContaining("/api/guild/guild123/greetings/images/"),
    });
    expect(footerBody).toEqual({
      slot: "footerIcon",
      fileName: expect.stringMatching(/^1234567891-.+\.png$/),
      url: expect.stringContaining("/api/guild/guild123/greetings/images/"),
    });
    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid image slots", async () => {
    const response = await POST(makeImageUploadRequest("avatar"), makeParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid image slot" });
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("rejects non-image files", async () => {
    const response = await POST(makeImageUploadRequest("image", "notes.txt", "text/plain"), makeParams());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "File must be an image" });
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});