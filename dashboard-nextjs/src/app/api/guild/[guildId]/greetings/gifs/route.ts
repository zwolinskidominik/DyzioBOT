import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { writeFile, unlink, readdir } from "fs/promises";
import path from "path";

const GIFS_DIR = path.join(process.cwd(), '../assets/lobby');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const files = await readdir(GIFS_DIR);
    const gifFiles = files
      .filter(file => file.toLowerCase().endsWith('.gif'))
      .map(file => ({
        name: file,
        url: `/api/gifs/${file}`
      }));

    return NextResponse.json(gifFiles);
  } catch (error) {
    console.error("Error fetching GIFs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('gif') as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.includes('gif')) {
      return NextResponse.json({ error: "File must be a GIF" }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) { // 8MB
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
    }

    const { guildId } = await params;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(GIFS_DIR, fileName);

    await writeFile(filePath, buffer);

    return NextResponse.json({
      name: fileName,
      url: `/api/gifs/${fileName}`
    });
  } catch (error) {
    console.error("Error uploading GIF:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('name');

    if (!fileName) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    const filePath = path.join(GIFS_DIR, fileName);
    await unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting GIF:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
