import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { writeFile, unlink, readdir, mkdir } from "fs/promises";
import path from "path";
import mongoose from "mongoose";

const DEFAULT_GIFS_DIR = path.join(process.cwd(), '../assets/lobby');
const UPLOADS_DIR = path.join(DEFAULT_GIFS_DIR, 'uploads');
const MAX_GREETING_GIFS = 5;

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

interface UploadedGifFileShape {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

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

function isSafeGuildId(guildId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(guildId);
}

function getGuildUploadsDir(guildId: string): string {
  return path.join(UPLOADS_DIR, guildId);
}

function toGifUrl(guildId: string, fileName: string, source: 'default' | 'upload'): string {
  return `/api/guild/${guildId}/greetings/gifs/${encodeURIComponent(fileName)}?source=${source}`;
}

function createGifItem(guildId: string, fileName: string, source: 'default' | 'upload', disabled = false) {
  return {
    name: fileName,
    source,
    disabled,
    url: toGifUrl(guildId, fileName, source),
  };
}

function createUploadFileName(fileName: string): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const gifFileName = sanitizedName.toLowerCase().endsWith('.gif') ? sanitizedName : `${sanitizedName}.gif`;

  return `${Date.now()}-${gifFileName}`;
}

function isUploadedGifFile(file: FormDataEntryValue | null): file is File {
  if (typeof file !== 'object' || file === null) {
    return false;
  }

  const candidate = file as Partial<UploadedGifFileShape>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.arrayBuffer === 'function'
  );
}

async function readGifFiles(directory: string): Promise<string[]> {
  try {
    const files = await readdir(directory);
    return files.filter(file => file.toLowerCase().endsWith('.gif'));
  } catch (error) {
    return [];
  }
}

async function getDisabledFileNames(guildId: string): Promise<Set<string>> {
  const disabledStates = await GreetingGifState
    .find({ guildId, disabled: true })
    .select('fileName')
    .lean();

  return new Set(disabledStates.map((state) => String(state.fileName)));
}

async function getVisibleGifFiles(guildId: string) {
  const disabledFileNames = await getDisabledFileNames(guildId);
  const [defaultFiles, uploadedFiles] = await Promise.all([
    readGifFiles(DEFAULT_GIFS_DIR),
    readGifFiles(getGuildUploadsDir(guildId)),
  ]);
  const defaultGifItems = defaultFiles.map(file => createGifItem(guildId, file, 'default', disabledFileNames.has(file)));
  const activeDefaultGifItems = defaultGifItems.filter(file => !file.disabled);
  const disabledDefaultGifItems = defaultGifItems.filter(file => file.disabled);
  const uploadedGifItems = uploadedFiles
    .filter(file => !disabledFileNames.has(file))
    .map(file => createGifItem(guildId, file, 'upload'));

  return [
    ...activeDefaultGifItems,
    ...uploadedGifItems,
    ...disabledDefaultGifItems,
  ];
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
    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }

    await connectDB();

    return NextResponse.json(await getVisibleGifFiles(guildId));
  } catch {
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

    if (!isUploadedGifFile(file)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.includes('gif')) {
      return NextResponse.json({ error: "File must be a GIF" }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) { // 8MB
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
    }

    const { guildId } = await params;
    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }

    const uploadDir = getGuildUploadsDir(guildId);
    const uploadedGifCount = (await readGifFiles(uploadDir)).length;
    if (uploadedGifCount >= MAX_GREETING_GIFS) {
      return NextResponse.json(
        { error: "GIF_LIMIT_REACHED", max: MAX_GREETING_GIFS },
        { status: 409 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = createUploadFileName(file.name);
    const filePath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, buffer);
    await connectDB();
    await GreetingGifState.deleteOne({ guildId, fileName });

    return NextResponse.json({
      name: fileName,
      source: 'upload',
      url: toGifUrl(guildId, fileName, 'upload')
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
    const source = searchParams.get('source') === 'upload' ? 'upload' : 'default';

    if (!fileName) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    if (source !== 'default') {
      return NextResponse.json({ error: "Only default GIFs can be toggled" }, { status: 400 });
    }

    if (!isSafeGifFilename(fileName)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const { disabled } = await request.json().catch(() => ({ disabled: true }));
    const shouldDisable = disabled !== false;
    const { guildId } = await params;
    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }

    await connectDB();

    if (shouldDisable) {
      await GreetingGifState.findOneAndUpdate(
        { guildId, fileName },
        {
          disabled: true,
          disabledBy: session.user.id,
          disabledAt: new Date(),
        },
        { upsert: true, new: true }
      );
    } else {
      await GreetingGifState.deleteOne({ guildId, fileName });
    }

    return NextResponse.json({
      success: true,
      mode: shouldDisable ? "hidden" : "restored",
      gif: createGifItem(guildId, fileName, 'default', shouldDisable),
    });
  } catch {
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
    const source = searchParams.get('source') === 'upload' ? 'upload' : 'default';

    if (!fileName) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    if (!isSafeGifFilename(fileName)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const { guildId } = await params;
    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }

    const userId = session.user.id;

    if (source === 'default') {
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

    const filePath = path.join(getGuildUploadsDir(guildId), fileName);
    await unlink(filePath);
    await connectDB();
    await GreetingGifState.deleteOne({ guildId, fileName });

    return NextResponse.json({ success: true, mode: "hard" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
