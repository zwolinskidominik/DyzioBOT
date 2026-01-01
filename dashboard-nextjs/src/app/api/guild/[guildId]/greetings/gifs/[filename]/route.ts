import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { readFile } from "fs/promises";
import path from "path";

const GIFS_DIR = path.join(process.cwd(), '../assets/lobby');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string; filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { filename } = await params;
    
    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    if (!filename.toLowerCase().endsWith('.gif')) {
      return NextResponse.json({ error: "File must be a GIF" }, { status: 400 });
    }

    const filePath = path.join(GIFS_DIR, filename);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error("Error serving GIF:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
