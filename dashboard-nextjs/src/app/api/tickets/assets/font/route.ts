import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { readFile } from "fs/promises";
import { join } from "path";

/** Serves assets/Ageer.otf so the dashboard preview can render the text-over-banner with the real bot font. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const buffer = await readFile(join(process.cwd(), "..", "assets", "Ageer.otf"));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "font/otf", "Cache-Control": "public, max-age=86400" },
    });
  } catch (error) {
    console.error("Error serving Ageer font asset:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
