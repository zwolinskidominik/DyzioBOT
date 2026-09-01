import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import { readdir } from "fs/promises";
import path from "path";
import mongoose from "mongoose";

// Uwaga: to jedyny działający endpoint tego pliku (GET). Upload/toggle/usuwanie GIF-ów
// idzie przez główny POST w ../route.ts (formData "gifState"/"gifUploads" → applyGifState()) —
// front-end nigdy nie wywołuje POST/PATCH/DELETE z tego pliku, więc zostały usunięte jako
// martwy, zduplikowany kod (ten sam wzorzec, co usunięty wcześniej greetings/images POST).
const DEFAULT_GIFS_DIR = path.join(process.cwd(), '../assets/lobby');
const UPLOADS_DIR = path.join(DEFAULT_GIFS_DIR, 'uploads');

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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }

    await connectDB();

    return NextResponse.json(await getVisibleGifFiles(guildId));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
