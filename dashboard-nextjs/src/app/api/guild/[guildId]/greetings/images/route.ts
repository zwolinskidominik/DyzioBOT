import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const IMAGES_DIR = path.join(process.cwd(), "../assets/greetings/uploads");
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".gif", ".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_IMAGE_SLOTS = new Set(["thumbnail", "image", "headerIcon", "footerIcon"]);

interface UploadedImageFileShape {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function isSafeGuildId(guildId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(guildId);
}

function isUploadedImageFile(file: FormDataEntryValue | null): file is File {
  if (typeof file !== "object" || file === null) {
    return false;
  }

  const candidate = file as Partial<UploadedImageFileShape>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

function createImageFileName(fileName: string, mimeType: string): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const extensionFromName = path.extname(sanitizedName).toLowerCase();
  const extension = ALLOWED_EXTENSIONS.has(extensionFromName)
    ? extensionFromName
    : mimeType === "image/webp"
      ? ".webp"
      : mimeType === "image/gif"
        ? ".gif"
        : mimeType === "image/png"
          ? ".png"
          : ".jpg";
  const baseName = sanitizedName.slice(0, sanitizedName.length - extensionFromName.length) || "image";

  return `${Date.now()}-${baseName}${extension}`;
}

function toImageUrl(guildId: string, fileName: string): string {
  return `/api/guild/${guildId}/greetings/images/${encodeURIComponent(fileName)}`;
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

    const { guildId } = await params;
    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }

    const formData = await request.formData();
    const slot = formData.get("slot");
    const file = formData.get("image");

    if (typeof slot !== "string" || !ALLOWED_IMAGE_SLOTS.has(slot)) {
      return NextResponse.json({ error: "Invalid image slot" }, { status: 400 });
    }

    if (!isUploadedImageFile(file)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
    }

    const fileName = createImageFileName(file.name, file.type);
    const uploadDir = path.join(IMAGES_DIR, guildId);
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, buffer);

    return NextResponse.json({
      slot,
      fileName,
      url: toImageUrl(guildId, fileName),
    });
  } catch (error) {
    console.error("Error uploading greeting image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}