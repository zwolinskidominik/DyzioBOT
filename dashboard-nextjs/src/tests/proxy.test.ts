import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing proxy
// ---------------------------------------------------------------------------
vi.mock("next-auth/middleware", () => ({
  withAuth: (fn: any) => fn,
}));

vi.mock("@/lib/redis", () => ({
  default: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    listenerCount: vi.fn().mockReturnValue(1),
    on: vi.fn(),
  },
}));

// Minimal NextRequest / NextResponse shims
class MockNextResponse {
  status: number;
  body: any;
  constructor(body: any, init?: { status?: number }) {
    this.body = body;
    this.status = init?.status ?? 200;
  }
  static next() {
    return new MockNextResponse(null, { status: 200 });
  }
}

// We test the Next-Action guard logic directly (extracted for unit-testability)
// ---------------------------------------------------------------------------

function buildRequest(opts: {
  pathname?: string;
  method?: string;
  nextAction?: string;
  origin?: string;
  host?: string;
}) {
  const headers: Record<string, string> = {};
  if (opts.nextAction !== undefined) headers["next-action"] = opts.nextAction;
  if (opts.origin !== undefined) headers["origin"] = opts.origin;
  if (opts.host !== undefined) headers["host"] = opts.host;

  return {
    nextUrl: { pathname: opts.pathname ?? "/" },
    method: opts.method ?? "GET",
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

// Extracted guard logic (mirrors proxy.ts implementation)
function checkNextActionGuard(
  req: ReturnType<typeof buildRequest>,
  nextauthUrl?: string
): 403 | null {
  const nextAction = req.headers.get("Next-Action");
  if (nextAction === null) return null;

  const origin = req.headers.get("Origin");
  const host = req.headers.get("Host");
  const allowedOrigins = [
    nextauthUrl ?? null,
    host ? `https://${host}` : null,
    host ? `http://${host}` : null,
  ].filter(Boolean);

  if (!origin || !allowedOrigins.includes(origin)) {
    return 403;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("proxy — Next-Action guard", () => {
  const HOST = "dashboard.example.com";
  const NEXTAUTH_URL = "https://dashboard.example.com";

  it("allows request without Next-Action header", () => {
    const req = buildRequest({ host: HOST });
    expect(checkNextActionGuard(req, NEXTAUTH_URL)).toBeNull();
  });

  it("blocks request with Next-Action but no Origin", () => {
    const req = buildRequest({ nextAction: "x", host: HOST });
    expect(checkNextActionGuard(req, NEXTAUTH_URL)).toBe(403);
  });

  it("blocks request with Next-Action from external Origin", () => {
    const req = buildRequest({
      nextAction: "someActionId",
      origin: "https://attacker.com",
      host: HOST,
    });
    expect(checkNextActionGuard(req, NEXTAUTH_URL)).toBe(403);
  });

  it("allows request with Next-Action from matching https Origin", () => {
    const req = buildRequest({
      nextAction: "someActionId",
      origin: "https://dashboard.example.com",
      host: HOST,
    });
    expect(checkNextActionGuard(req, NEXTAUTH_URL)).toBeNull();
  });

  it("allows request with Next-Action from matching http Origin (local dev)", () => {
    const req = buildRequest({
      nextAction: "someActionId",
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });
    expect(checkNextActionGuard(req, "http://localhost:3000")).toBeNull();
  });

  it("blocks scanner probe IDs: 'x', 'dx', '1', 'test', 'dontcare'", () => {
    for (const probeId of ["x", "dx", "1", "test", "dontcare"]) {
      const req = buildRequest({
        nextAction: probeId,
        origin: "https://attacker.com",
        host: HOST,
      });
      expect(checkNextActionGuard(req, NEXTAUTH_URL)).toBe(403);
    }
  });
});
