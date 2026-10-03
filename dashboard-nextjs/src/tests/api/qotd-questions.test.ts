import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
//
// Pula pytań (Question) jest globalna, a to, które pytania dany serwer już wysłał, trzyma
// osobna kolekcja UsedQuestion (guildId + questionId). Trasa tworzy oba modele przez
// mongoose.model(name, ...), więc mock zwraca osobny obiekt dla każdej nazwy.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const Question = Object.assign(function QuestionCtor() {}, {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  });
  const UsedQuestion = Object.assign(function UsedQuestionCtor() {}, {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  });
  return { Question, UsedQuestion };
});

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));
// Właściciel bota przechodzi requireGuildAccess bez odpytywania Discorda.
vi.mock("@/lib/owner", () => ({ OWNER_IDS: ["u1"] }));
vi.mock("mongoose", () => {
  class Schema {
    constructor(_def: unknown, _opts?: unknown) {}
  }
  return {
    default: {
      connection: { readyState: 1 },
      connect: vi.fn(),
      Schema,
      model: vi.fn((name: string) => (name === "Question" ? mocks.Question : mocks.UsedQuestion)),
      models: {},
      trusted: <T,>(value: T) => value,
    },
  };
});

import { getServerSession } from "next-auth";
import { GET, PATCH } from "@/app/api/guild/[guildId]/qotd/questions/route";

const GUILD_ID = "guild123";

// Helper: build a minimal NextRequest-like object
function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(url, opts) as never;
}

function makeParams(guildId = GUILD_ID) {
  return { params: Promise.resolve({ guildId }) };
}

/** UsedQuestion.find(...).sort(...).lean() */
function mockUsedForGuild(rows: { questionId: string; usedAt: Date }[]) {
  mocks.UsedQuestion.find.mockReturnValueOnce({
    sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" }, accessToken: "token" } as never);
});

// ---------------------------------------------------------------------------
// GET — aktywne vs. użyte na TYM serwerze
// ---------------------------------------------------------------------------
describe("GET /api/guild/[guildId]/qotd/questions", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions");
    const res = await GET(req, makeParams());
    expect(res.status).toBe(401);
  });

  it("?disabled=true returns the questions this guild has already used, scoped by guildId", async () => {
    const usedAt = new Date("2026-09-01T10:00:00Z");
    mockUsedForGuild([{ questionId: "q1", usedAt }]);
    mocks.Question.find.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue([{ questionId: "q1", content: "Old Q" }]),
    });

    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions?disabled=true");
    const res = await GET(req, makeParams());
    expect(res.status).toBe(200);

    // Użycie liczy się per serwer — zapytanie MUSI być ograniczone do guildId z URL.
    expect(mocks.UsedQuestion.find).toHaveBeenCalledWith({ guildId: GUILD_ID });
    expect(mocks.Question.find).toHaveBeenCalledWith({ questionId: { $in: ["q1"] } });

    const body = await res.json();
    expect(body).toEqual([
      expect.objectContaining({ questionId: "q1", disabled: true, usedAt: usedAt.toISOString() }),
    ]);
  });

  it("without ?disabled returns enabled pool questions this guild has not used yet", async () => {
    mockUsedForGuild([{ questionId: "q1", usedAt: new Date() }]);
    mocks.Question.find.mockReturnValueOnce({ sort: vi.fn().mockResolvedValue([]) });

    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions");
    const res = await GET(req, makeParams());
    expect(res.status).toBe(200);

    expect(mocks.UsedQuestion.find).toHaveBeenCalledWith({ guildId: GUILD_ID });
    expect(mocks.Question.find).toHaveBeenCalledWith({
      disabled: { $ne: true },
      questionId: { $nin: ["q1"] },
    });
  });
});

// ---------------------------------------------------------------------------
// PATCH — restore (disabled: false) przywraca pytanie TYLKO dla tego serwera
// ---------------------------------------------------------------------------
describe("PATCH /api/guild/[guildId]/qotd/questions — restore", () => {
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

  it("restores the question by removing this guild's usage record, without touching the global pool", async () => {
    mocks.Question.findOne.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({ questionId: "q1", content: "Q?" }),
    });

    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions", {
      method: "PATCH",
      body: JSON.stringify({ questionId: "q1", disabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ questionId: "q1", disabled: false });
    expect(mocks.UsedQuestion.deleteOne).toHaveBeenCalledWith({ guildId: GUILD_ID, questionId: "q1" });
    expect(mocks.Question.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when question not found during restore", async () => {
    mocks.Question.findOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });

    const req = makeRequest("http://localhost/api/guild/g1/qotd/questions", {
      method: "PATCH",
      body: JSON.stringify({ questionId: "nonexistent", disabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(404);
    expect(mocks.UsedQuestion.deleteOne).not.toHaveBeenCalled();
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
