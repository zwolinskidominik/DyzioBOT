import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

const sessionCache = new Map<string, { session: any; timestamp: number }>();
const SESSION_CACHE_TTL = 30 * 1000;

export async function quickAuthCheck(request: Request): Promise<{ 
  authorized: boolean; 
  session: any | null;
  response?: NextResponse;
}> {
  try {
    const authHeader = request.headers.get('cookie');
    if (authHeader) {
      const cached = sessionCache.get(authHeader);
      if (cached && Date.now() - cached.timestamp < SESSION_CACHE_TTL) {
        return { authorized: true, session: cached.session };
      }
    }

    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return {
        authorized: false,
        session: null,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      };
    }

    if (authHeader) {
      sessionCache.set(authHeader, { session, timestamp: Date.now() });
    }

    return { authorized: true, session };
  } catch (error) {
    console.error("Auth check error:", error);
    return {
      authorized: false,
      session: null,
      response: NextResponse.json({ error: "Auth error" }, { status: 500 })
    };
  }
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessionCache.entries()) {
      if (now - value.timestamp > SESSION_CACHE_TTL) {
        sessionCache.delete(key);
      }
    }
  }, 60 * 1000);
}

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}
