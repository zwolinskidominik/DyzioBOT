import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { JWT } from "next-auth/jwt";
import redis from "@/lib/redis";

// ---------------------------------------------------------------------------
// Redis sliding-window rate limiter
// Requires experimental.nodeMiddleware: true in next.config.ts
// Uses shared singleton from @/lib/redis (one connection for the whole process)
// ---------------------------------------------------------------------------
const WINDOW_SECONDS = 60;
const LIMITS = { read: 120, write: 30 } as const;

async function checkRateLimit(ip: string, isWrite: boolean): Promise<boolean> {
  // Fixed-window bucket: key changes every 60s — atomic INCR + EXPIRE
  const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  const key = `rl:${ip}:${isWrite ? "w" : "r"}:${bucket}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // Set TTL only on first increment (avoid resetting window on each request)
      await redis.expire(key, WINDOW_SECONDS * 2);
    }
    return count <= (isWrite ? LIMITS.write : LIMITS.read);
  } catch {
    // Redis down → fail open (allow request, never block due to infra issue)
    return true;
  }
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Combined middleware: rate limiting + NextAuth auth guard
// ---------------------------------------------------------------------------
export default withAuth(
  async function middleware(req: NextRequest) {
    // Block external Server Action probing (scanners sending Next-Action: x/test/1/dx)
    // Legitimate browser requests always include an Origin matching our own host.
    const nextAction = req.headers.get("Next-Action");
    if (nextAction !== null) {
      const origin = req.headers.get("Origin");
      const host = req.headers.get("Host");
      const allowedOrigins = [
        process.env.NEXTAUTH_URL,
        host ? `https://${host}` : null,
        host ? `http://${host}` : null,
      ].filter(Boolean);
      if (!origin || !allowedOrigins.includes(origin)) {
        return new NextResponse(null, { status: 403 });
      }
    }

    if (req.nextUrl.pathname.startsWith("/api/")) {
      const ip = getClientIP(req);
      const isWrite = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method);

      const allowed = await checkRateLimit(ip, isWrite);
      if (!allowed) {
        return new NextResponse(
          JSON.stringify({ error: "Too Many Requests" }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(WINDOW_SECONDS),
            },
          }
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }: { token: JWT | null }) => token !== null,
    },
    pages: {
      signIn: "/",
    },
  }
);

export const config = {
  matcher: [
    "/((?!$|api/auth|api/health|_next/static|_next/image|deezy\\.png|favicon).*)",
  ],
};
