import { NextResponse } from "next/server";
import { getHealth } from "@/lib/health";

/**
 * Publiczny stan usługi dla zewnętrznego monitora (Better Stack → status.deezy.cc).
 * 200 = wszystko działa, 503 = bot albo baza niedostępne. Bez logowania (wyjątek w src/proxy.ts).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getHealth();
  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
