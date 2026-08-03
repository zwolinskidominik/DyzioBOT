import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { readFile } from "fs/promises";
import path from "path";

const DEFAULT_GIFS_DIR = path.join(process.cwd(), '../assets/lobby');
const UPLOADS_DIR = path.join(DEFAULT_GIFS_DIR, 'uploads');

function isSafeGuildId(guildId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(guildId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string; filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId, filename } = await params;
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') === 'upload' ? 'upload' : 'default';

    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }
    
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    if (!filename.toLowerCase().endsWith('.gif')) {
      return NextResponse.json({ error: "File must be a GIF" }, { status: 400 });
    }

    const filePath = source === 'upload'
      ? path.join(UPLOADS_DIR, guildId, filename)
      : path.join(DEFAULT_GIFS_DIR, filename);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
