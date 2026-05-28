import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { OWNER_IDS } from "@/lib/owner";
import { writeFile, unlink, readdir } from "fs/promises";
import path from "path";
import mongoose from "mongoose";

const GIFS_DIR = path.join(process.cwd(), '../assets/lobby');

const greetingGifStateSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  fileName: { type: String, required: true },
  disabled: { type: Boolean, default: true },
  disabledBy: { type: String },
  disabledAt: { type: Date },
}, {
  collection: 'greetinggifstates',
  timestamps: true,
});

greetingGifStateSchema.index({ guildId: 1, fileName: 1 }, { unique: true });

const GreetingGifState = mongoose.models.GreetingGifState || mongoose.model('GreetingGifState', greetingGifStateSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI!);
}

function isSafeGifFilename(fileName: string): boolean {
  return (
    fileName.toLowerCase().endsWith('.gif') &&
    !fileName.includes('..') &&
    !fileName.includes('/') &&
    !fileName.includes('\\')
  );
}

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
    await connectDB();

    const disabledStates = await GreetingGifState
      .find({ guildId, disabled: true })
      .select('fileName')
      .lean();
    const disabledFileNames = new Set(disabledStates.map((state) => String(state.fileName)));

    const files = await readdir(GIFS_DIR);
    const gifFiles = files
      .filter(file => file.toLowerCase().endsWith('.gif') && !disabledFileNames.has(file))
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
    const file = formData.get('gif');

    if (!(file instanceof File)) {
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
    await connectDB();
    await GreetingGifState.deleteOne({ guildId, fileName });

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

    if (!isSafeGifFilename(fileName)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const { guildId } = await params;
    const userId = session.user.id;
    const isOwner = OWNER_IDS.includes(userId ?? "");

    if (!isOwner) {
      await connectDB();
      await GreetingGifState.findOneAndUpdate(
        { guildId, fileName },
        {
          disabled: true,
          disabledBy: userId,
          disabledAt: new Date(),
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({ success: true, mode: "soft" });
    }

    const filePath = path.join(GIFS_DIR, fileName);
    await unlink(filePath);
    await connectDB();
    await GreetingGifState.deleteMany({ fileName });

    return NextResponse.json({ success: true, mode: "hard" });
  } catch (error) {
    console.error("Error deleting GIF:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
