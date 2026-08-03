import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { readFile } from "fs/promises";
import { join } from "path";

/** Bundled preset banners shown in the "Gotowe" gallery — allow-listed to prevent path traversal. */
const ALLOWED_PRESETS = new Set([
  "ticketBanner.png",
  "ticketReport.png",
  "ticketPartnership.png",
  "ticketIdea.png",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename } = await params;
    if (!ALLOWED_PRESETS.has(filename)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await readFile(join(process.cwd(), "..", "assets", "tickets", filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) {
    console.error("Error serving preset banner asset:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
