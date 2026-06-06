import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { readFile } from "fs/promises";
import path from "path";

const IMAGES_DIR = path.join(process.cwd(), "../assets/greetings/uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function isSafeGuildId(guildId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(guildId);
}

function isSafeImageFilename(fileName: string): boolean {
  const extension = path.extname(fileName).toLowerCase();

  return (
    Boolean(CONTENT_TYPES[extension]) &&
    !fileName.includes("..") &&
    !fileName.includes("/") &&
    !fileName.includes("\\")
  );
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
    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }

    if (!isSafeImageFilename(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(IMAGES_DIR, guildId, filename);
    const fileBuffer = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}