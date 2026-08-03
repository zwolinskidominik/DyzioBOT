import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));
vi.mock("mongoose", () => {
  const findOneAndUpdateMock = vi.fn();
  const findMock = vi.fn();
  const saveMock = vi.fn();

  function QuestionModelMock(this: any, data: any) {
    Object.assign(this, data);
    this.save = saveMock;
    this.toObject = () => data;
  }
  QuestionModelMock.find = findMock;
  QuestionModelMock.findOneAndUpdate = findOneAndUpdateMock;
  QuestionModelMock.deleteOne = vi.fn();

  class Schema {
    constructor(_def: any, _opts?: any) {}
  }

  return {
    default: {
      connection: { readyState: 1 },
      connect: vi.fn(),
      Schema,
      model: vi.fn().mockReturnValue(QuestionModelMock),
      models: {},
    },
    __mocks: { findOneAndUpdate: findOneAndUpdateMock, find: findMock, save: saveMock },
  };
});

import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { GET, PATCH } from "@/app/api/guild/[guildId]/qotd/questions/route";

// Helper: build a minimal NextRequest-like object
function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(url, opts) as any;
}

function makeParams(guildId = "guild123") {
  return { params: Promise.resolve({ guildId }) };
}

// ---------------------------------------------------------------------------
// GET — ?disabled=true filter
// ---------------------------------------------------------------------------
describe("GET /api/guild/[guildId]/qotd/questions", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } } as any);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions");
    const res = await GET(req, makeParams());
    expect(res.status).toBe(401);
  });

  it("filters by disabled:true when ?disabled=true", async () => {
    const QuestionModel = (mongoose.model as any)();
    QuestionModel.find.mockReturnValueOnce({
      sort: vi.fn().mockResolvedValueOnce([
        { questionId: "q1", content: "Old Q", disabled: true },
      ]),
    });

    const req = makeRequest(
      "http://localhost/api/guild/g1/qotd/questions?disabled=true"
    );
    const res = await GET(req, makeParams());
    expect(res.status).toBe(200);

    // Verify find was called with { disabled: true }
    expect(QuestionModel.find).toHaveBeenCalledWith({ disabled: true });
  });

  it("filters active questions when no ?disabled param", async () => {
    const QuestionModel = (mongoose.model as any)();
    QuestionModel.find.mockReturnValueOnce({
      sort: vi.fn().mockResolvedValueOnce([]),
    });

    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions");
    await GET(req, makeParams());

    expect(QuestionModel.find).toHaveBeenCalledWith({ disabled: { $ne: true } });
  });
});

// ---------------------------------------------------------------------------
// PATCH — restore action (disabled: false)
// ---------------------------------------------------------------------------
describe("PATCH /api/guild/[guildId]/qotd/questions — restore", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } } as any);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions", {
      method: "PATCH",
      body: JSON.stringify({ questionId: "q1", disabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 when questionId is missing", async () => {
    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions", {
      method: "PATCH",
      body: JSON.stringify({ disabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });

  it("restores question (sets disabled: false) and returns updated doc", async () => {
    const QuestionModel = (mongoose.model as any)();
    const updated = { questionId: "q1", content: "Q?", disabled: false };
    QuestionModel.findOneAndUpdate.mockResolvedValueOnce({
      ...updated,
      toObject: () => updated,
    });

    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions", {
      method: "PATCH",
      body: JSON.stringify({ questionId: "q1", disabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.disabled).toBe(false);
    expect(QuestionModel.findOneAndUpdate).toHaveBeenCalledWith(
      { questionId: "q1" },
      { disabled: false },
      { new: true }
    );
  });

  it("returns 404 when question not found during restore", async () => {
    const QuestionModel = (mongoose.model as any)();
    QuestionModel.findOneAndUpdate.mockResolvedValueOnce(null);

    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions", {
      method: "PATCH",
      body: JSON.stringify({ questionId: "nonexistent", disabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(404);
  });

  it("regular update validates content is required", async () => {
    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions", {
      method: "PATCH",
      body: JSON.stringify({ questionId: "q1", content: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });
});
