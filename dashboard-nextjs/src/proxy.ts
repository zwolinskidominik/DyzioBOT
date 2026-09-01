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

interface RateLimitResult {
  allowed: boolean;
  /** Ustawione tylko gdy odmowa wynika z awarii Redis, nie z przekroczenia limitu. */
  limiterUnavailable?: boolean;
}

async function checkRateLimit(ip: string, isWrite: boolean): Promise<RateLimitResult> {
  // Fixed-window bucket: key changes every 60s — atomic INCR + EXPIRE
  const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  const key = `rl:${ip}:${isWrite ? "w" : "r"}:${bucket}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // Set TTL only on first increment (avoid resetting window on each request)
      await redis.expire(key, WINDOW_SECONDS * 2);
    }
    return { allowed: count <= (isWrite ? LIMITS.write : LIMITS.read) };
  } catch {
    // Redis down: odczyty zostają fail-open (awaria infrastruktury nie powinna
    // wyłączyć całego dashboardu). Zapisy (POST/PATCH/PUT/DELETE) idą fail-closed,
    // ale TYLKO na produkcji — lokalny dev bardzo często działa bez Redisa/Dockera
    // (patrz komentarz w lib/redis.ts), więc fail-closed w dev zablokowałoby
    // każdy zapis w dashboardzie developerowi bez uruchomionego Redisa.
    const isProd = process.env.NODE_ENV === "production";
    const shouldBlock = isWrite && isProd;
    return { allowed: !shouldBlock, limiterUnavailable: shouldBlock };
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

      const result = await checkRateLimit(ip, isWrite);
      if (!result.allowed) {
        if (result.limiterUnavailable) {
          return new NextResponse(
            JSON.stringify({ error: "Service temporarily unavailable" }),
            {
              status: 503,
              headers: { "Content-Type": "application/json", "Retry-After": "5" },
            }
          );
        }
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
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!$|login|api/auth|api/health|_next/static|_next/image|deezy\\.png|favicon).*)",
  ],
};
