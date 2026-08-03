import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { readFile } from "fs/promises";
import { join } from "path";

/** Serves the base assets/banner.png texture so the dashboard can render a CSS-approximated live preview of text-over-banner tickets. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const buffer = await readFile(join(process.cwd(), "..", "assets", "banner.png"));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) {
    console.error("Error serving banner asset:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
