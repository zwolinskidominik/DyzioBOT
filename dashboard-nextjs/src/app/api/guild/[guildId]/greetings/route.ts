import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { mkdir, readdir, unlink, writeFile } from "fs/promises";
import path from "path";
import mongoose from "mongoose";

const DEFAULT_EMBED_COLOR = "#3b82f6";
const IMAGES_DIR = path.join(process.cwd(), "../assets/greetings/uploads");
const DEFAULT_GIFS_DIR = path.join(process.cwd(), "../assets/lobby");
const GIF_UPLOADS_DIR = path.join(DEFAULT_GIFS_DIR, "uploads");
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_GREETING_GIFS = 5;
const ALLOWED_IMAGE_EXTENSIONS = new Set([".gif", ".jpg", ".jpeg", ".png", ".webp"]);
const MESSAGE_MODULES = ["welcome", "dm", "goodbye"] as const;
const IMAGE_SLOTS = ["thumbnail", "image", "headerIcon", "footerIcon"] as const;

type MessageModule = typeof MESSAGE_MODULES[number];
type ImageSlot = typeof IMAGE_SLOTS[number];

const imageFieldMap: Record<MessageModule, Record<ImageSlot, string>> = {
  welcome: {
    thumbnail: "welcomeThumbnailFile",
    image: "welcomeCustomImageFile",
    headerIcon: "welcomeHeaderIconFile",
    footerIcon: "welcomeFooterIconFile",
  },
  dm: {
    thumbnail: "dmThumbnailFile",
    image: "dmCustomImageFile",
    headerIcon: "dmHeaderIconFile",
    footerIcon: "dmFooterIconFile",
  },
  goodbye: {
    thumbnail: "goodbyeThumbnailFile",
    image: "goodbyeCustomImageFile",
    headerIcon: "goodbyeHeaderIconFile",
    footerIcon: "goodbyeFooterIconFile",
  },
};

const stringConfigFields = [
  "greetingsChannelId",
  "goodbyeChannelId",
  "rulesChannelId",
  "rolesChannelId",
  "chatChannelId",
  "welcomeMessageMode",
  "welcomeMessage",
  "welcomeTitleText",
  "welcomeEmbedColor",
  "welcomeHeaderText",
  "welcomeFooterText",
  "welcomeImageMode",
  "welcomeThumbnailMode",
  "welcomeThumbnailFile",
  "welcomeCustomImageFile",
  "welcomeHeaderIconFile",
  "welcomeFooterIconFile",
  "dmMessageMode",
  "dmMessage",
  "dmTitleText",
  "dmEmbedColor",
  "dmHeaderText",
  "dmFooterText",
  "dmImageMode",
  "dmThumbnailMode",
  "dmThumbnailFile",
  "dmCustomImageFile",
  "dmHeaderIconFile",
  "dmFooterIconFile",
  "goodbyeMessageMode",
  "goodbyeMessage",
  "goodbyeTitleText",
  "goodbyeEmbedColor",
  "goodbyeHeaderText",
  "goodbyeFooterText",
  "goodbyeImageMode",
  "goodbyeThumbnailMode",
  "goodbyeThumbnailFile",
  "goodbyeCustomImageFile",
  "goodbyeHeaderIconFile",
  "goodbyeFooterIconFile",
] as const;

const booleanConfigFields = ["enabled", "welcomeEnabled", "goodbyeEnabled", "dmEnabled"] as const;

const greetingsConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  greetingsChannelId: { type: String, required: true },
  goodbyeChannelId: { type: String },
  rulesChannelId: { type: String },
  rolesChannelId: { type: String },
  chatChannelId: { type: String },
  welcomeEnabled: { type: Boolean, default: true },
  goodbyeEnabled: { type: Boolean, default: true },
  dmEnabled: { type: Boolean, default: false },
  welcomeMessageMode: { type: String, enum: ["embed", "text"], default: "embed" },
  welcomeMessage: { type: String },
  welcomeTitleText: { type: String, default: "Witaj na {server}" },
  welcomeEmbedColor: { type: String, default: DEFAULT_EMBED_COLOR },
  welcomeHeaderText: { type: String, default: "" },
  welcomeFooterText: { type: String, default: "" },
  welcomeImageMode: { type: String, enum: ["gifs", "custom", "none"], default: "gifs" },
  welcomeThumbnailMode: { type: String, enum: ["avatar", "custom", "none"], default: "avatar" },
  welcomeThumbnailFile: { type: String },
  welcomeCustomImageFile: { type: String },
  welcomeHeaderIconFile: { type: String },
  welcomeFooterIconFile: { type: String },
  dmMessageMode: { type: String, enum: ["embed", "text"], default: "embed" },
  dmMessage: { type: String },
  dmTitleText: { type: String, default: "Witaj na {server}" },
  dmEmbedColor: { type: String, default: DEFAULT_EMBED_COLOR },
  dmHeaderText: { type: String, default: "" },
  dmFooterText: { type: String, default: "" },
  dmImageMode: { type: String, enum: ["gifs", "custom", "none"], default: "none" },
  dmThumbnailMode: { type: String, enum: ["avatar", "custom", "none"], default: "avatar" },
  dmThumbnailFile: { type: String },
  dmCustomImageFile: { type: String },
  dmHeaderIconFile: { type: String },
  dmFooterIconFile: { type: String },
  goodbyeMessageMode: { type: String, enum: ["embed", "text"], default: "embed" },
  goodbyeMessage: { type: String },
  goodbyeTitleText: { type: String, default: "Do zobaczenia, {username}" },
  goodbyeEmbedColor: { type: String, default: "#ef4444" },
  goodbyeHeaderText: { type: String, default: "" },
  goodbyeFooterText: { type: String, default: "" },
  goodbyeImageMode: { type: String, enum: ["gifs", "custom", "none"], default: "none" },
  goodbyeThumbnailMode: { type: String, enum: ["avatar", "custom", "none"], default: "avatar" },
  goodbyeThumbnailFile: { type: String },
  goodbyeCustomImageFile: { type: String },
  goodbyeHeaderIconFile: { type: String },
  goodbyeFooterIconFile: { type: String },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: "greetingsconfigurations",
});

const greetingGifStateSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  fileName: { type: String, required: true },
  disabled: { type: Boolean, default: true },
  disabledBy: { type: String },
  disabledAt: { type: Date },
}, {
  collection: "greetinggifstates",
  timestamps: true,
});

greetingGifStateSchema.index({ guildId: 1, fileName: 1 }, { unique: true });

const GreetingsConfig = mongoose.models.GreetingsConfig || mongoose.model("GreetingsConfig", greetingsConfigSchema);
const GreetingGifState = mongoose.models.GreetingGifState || mongoose.model("GreetingGifState", greetingGifStateSchema);

interface UploadedFileShape {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

interface GifStatePayload {
  disabledDefaultNames: string[];
  deletedUploadNames: string[];
}

interface GifItem {
  name: string;
  source: "default" | "upload";
  disabled?: boolean;
  url: string;
}

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;

  await mongoose.connect(process.env.MONGODB_URI!);
}

function isSafeGuildId(guildId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(guildId);
}

function isSafeFileName(fileName?: string): fileName is string {
  return Boolean(fileName && !fileName.includes("..") && !fileName.includes("/") && !fileName.includes("\\"));
}

function isSafeGifFileName(fileName?: string): fileName is string {
  return Boolean(isSafeFileName(fileName) && fileName.toLowerCase().endsWith(".gif"));
}

function isUploadedFile(file: FormDataEntryValue | null): file is File {
  if (typeof file !== "object" || file === null) return false;

  const candidate = file as Partial<UploadedFileShape>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
}

function getDefaultConfig(guildId: string) {
  return {
    guildId,
    enabled: false,
    greetingsChannelId: "",
    goodbyeChannelId: "",
    rulesChannelId: "",
    rolesChannelId: "",
    chatChannelId: "",
    welcomeEnabled: true,
    goodbyeEnabled: true,
    dmEnabled: false,
    welcomeMessageMode: "embed",
    welcomeMessage: "",
    welcomeTitleText: "Witaj na {server}",
    welcomeEmbedColor: DEFAULT_EMBED_COLOR,
    welcomeHeaderText: "",
    welcomeFooterText: "",
    welcomeImageMode: "gifs",
    welcomeThumbnailMode: "avatar",
    welcomeThumbnailFile: "",
    welcomeCustomImageFile: "",
    welcomeHeaderIconFile: "",
    welcomeFooterIconFile: "",
    dmMessageMode: "embed",
    dmMessage: "",
    dmTitleText: "Witaj na {server}",
    dmEmbedColor: DEFAULT_EMBED_COLOR,
    dmHeaderText: "",
    dmFooterText: "",
    dmImageMode: "none",
    dmThumbnailMode: "avatar",
    dmThumbnailFile: "",
    dmCustomImageFile: "",
    dmHeaderIconFile: "",
    dmFooterIconFile: "",
    goodbyeMessageMode: "embed",
    goodbyeMessage: "",
    goodbyeTitleText: "Do zobaczenia, {username}",
    goodbyeEmbedColor: "#ef4444",
    goodbyeHeaderText: "",
    goodbyeFooterText: "",
    goodbyeImageMode: "none",
    goodbyeThumbnailMode: "avatar",
    goodbyeThumbnailFile: "",
    goodbyeCustomImageFile: "",
    goodbyeHeaderIconFile: "",
    goodbyeFooterIconFile: "",
  };
}

function buildConfigPayload(input: unknown) {
  const source = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const payload: Record<string, string | boolean | Date> = {};

  stringConfigFields.forEach((field) => {
    const value = source[field];
    if (typeof value === "string") payload[field] = value;
  });

  booleanConfigFields.forEach((field) => {
    const value = source[field];
    if (typeof value === "boolean") payload[field] = value;
  });

  payload.updatedAt = new Date();

  return payload;
}

function parseJson(value: string | null): unknown {
  if (!value) return {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseGifStatePayload(value: string | null): GifStatePayload {
  const parsed = parseJson(value);
  if (typeof parsed !== "object" || parsed === null) {
    return { disabledDefaultNames: [], deletedUploadNames: [] };
  }

  const source = parsed as Record<string, unknown>;
  const disabledDefaultNames = Array.isArray(source.disabledDefaultNames)
    ? source.disabledDefaultNames.filter((item): item is string => typeof item === "string" && isSafeGifFileName(item))
    : [];
  const deletedUploadNames = Array.isArray(source.deletedUploadNames)
    ? source.deletedUploadNames.filter((item): item is string => typeof item === "string" && isSafeGifFileName(item))
    : [];

  return { disabledDefaultNames, deletedUploadNames };
}

function getGuildImagesDir(guildId: string): string {
  return path.join(IMAGES_DIR, guildId);
}

function getGuildGifUploadsDir(guildId: string): string {
  return path.join(GIF_UPLOADS_DIR, guildId);
}

function getImageFilePath(guildId: string, fileName: string): string {
  return path.join(getGuildImagesDir(guildId), fileName);
}

function getGifUploadPath(guildId: string, fileName: string): string {
  return path.join(getGuildGifUploadsDir(guildId), fileName);
}

function createImageFileName(moduleKey: MessageModule, slot: ImageSlot, fileName: string, mimeType: string): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const extensionFromName = path.extname(sanitizedName).toLowerCase();
  const extension = ALLOWED_IMAGE_EXTENSIONS.has(extensionFromName)
    ? extensionFromName
    : mimeType === "image/webp"
      ? ".webp"
      : mimeType === "image/gif"
        ? ".gif"
        : mimeType === "image/png"
          ? ".png"
          : ".jpg";
  const baseName = sanitizedName.slice(0, sanitizedName.length - extensionFromName.length) || "image";

  return `${Date.now()}-${moduleKey}-${slot}-${baseName}${extension}`;
}

function createGifFileName(fileName: string): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const gifFileName = sanitizedName.toLowerCase().endsWith(".gif") ? sanitizedName : `${sanitizedName}.gif`;

  return `${Date.now()}-${gifFileName}`;
}

async function readGifFiles(directory: string): Promise<string[]> {
  try {
    const files = await readdir(directory);
    return files.filter((file) => file.toLowerCase().endsWith(".gif"));
  } catch {
    return [];
  }
}

function toGifUrl(guildId: string, fileName: string, source: "default" | "upload"): string {
  return `/api/guild/${guildId}/greetings/gifs/${encodeURIComponent(fileName)}?source=${source}`;
}

function createGifItem(guildId: string, fileName: string, source: "default" | "upload", disabled = false): GifItem {
  return {
    name: fileName,
    source,
    disabled,
    url: toGifUrl(guildId, fileName, source),
  };
}

async function getDisabledFileNames(guildId: string): Promise<Set<string>> {
  const disabledStates = await GreetingGifState
    .find({ guildId, disabled: true })
    .select("fileName")
    .lean();

  return new Set(disabledStates.map((state) => String(state.fileName)));
}

async function getGifItems(guildId: string): Promise<GifItem[]> {
  const disabledFileNames = await getDisabledFileNames(guildId);
  const [defaultFiles, uploadedFiles] = await Promise.all([
    readGifFiles(DEFAULT_GIFS_DIR),
    readGifFiles(getGuildGifUploadsDir(guildId)),
  ]);
  const defaultGifItems = defaultFiles.map((file) => createGifItem(guildId, file, "default", disabledFileNames.has(file)));
  const activeDefaultGifItems = defaultGifItems.filter((file) => !file.disabled);
  const disabledDefaultGifItems = defaultGifItems.filter((file) => file.disabled);
  const uploadedGifItems = uploadedFiles
    .filter((file) => !disabledFileNames.has(file))
    .map((file) => createGifItem(guildId, file, "upload"));

  return [...activeDefaultGifItems, ...uploadedGifItems, ...disabledDefaultGifItems];
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // File may have already been removed; cleanup should not break config saving.
  }
}

async function applyGifState(guildId: string, userId: string | undefined, formData: FormData) {
  const gifState = parseGifStatePayload(typeof formData.get("gifState") === "string" ? String(formData.get("gifState")) : null);
  const uploadFiles = formData.getAll("gifUploads").filter(isUploadedFile);
  const uploadDir = getGuildGifUploadsDir(guildId);

  const existingUploadFiles = await readGifFiles(uploadDir);
  const remainingUploadCount = existingUploadFiles.filter((fileName) => !gifState.deletedUploadNames.includes(fileName)).length;
  if (remainingUploadCount + uploadFiles.length > MAX_GREETING_GIFS) {
    throw new Error(`Możesz dodać maksymalnie ${MAX_GREETING_GIFS} GIF-ów`);
  }

  await Promise.all(gifState.deletedUploadNames.map((fileName) => safeUnlink(getGifUploadPath(guildId, fileName))));

  await mkdir(uploadDir, { recursive: true });
  await Promise.all(uploadFiles.map(async (file) => {
    if (!file.type.includes("gif")) {
      throw new Error("Plik musi być w formacie GIF");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Maksymalny rozmiar GIF-a to 8MB");
    }

    const fileName = createGifFileName(file.name);
    await writeFile(getGifUploadPath(guildId, fileName), Buffer.from(await file.arrayBuffer()));
    await GreetingGifState.deleteOne({ guildId, fileName });
  }));

  await GreetingGifState.deleteMany({ guildId, fileName: { $nin: gifState.disabledDefaultNames } });
  await Promise.all(gifState.disabledDefaultNames.map((fileName) => GreetingGifState.findOneAndUpdate(
    { guildId, fileName },
    {
      disabled: true,
      disabledBy: userId,
      disabledAt: new Date(),
    },
    { upsert: true, new: true }
  )));
}

async function savePendingImages(guildId: string, formData: FormData, payload: Record<string, string | boolean | Date>) {
  const uploadDir = getGuildImagesDir(guildId);
  const writtenFiles: string[] = [];

  await mkdir(uploadDir, { recursive: true });

  for (const moduleKey of MESSAGE_MODULES) {
    for (const slot of IMAGE_SLOTS) {
      const file = formData.get(`${moduleKey}.${slot}`);
      if (!isUploadedFile(file)) continue;

      if (!file.type.startsWith("image/")) {
        throw new Error("Plik musi być obrazem");
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error("Maksymalny rozmiar obrazka to 8MB");
      }

      const fileName = createImageFileName(moduleKey, slot, file.name, file.type);
      const filePath = getImageFilePath(guildId, fileName);
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
      payload[imageFieldMap[moduleKey][slot]] = fileName;
      writtenFiles.push(filePath);
    }
  }

  return writtenFiles;
}

async function cleanupReplacedImages(guildId: string, previousConfig: Record<string, unknown> | null, nextConfig: Record<string, unknown>) {
  if (!previousConfig) return;

  const nextImageNames = new Set(
    Object.values(imageFieldMap)
      .flatMap((slotMap) => Object.values(slotMap))
      .map((field) => nextConfig[field])
      .filter((fileName): fileName is string => typeof fileName === "string" && fileName.length > 0)
  );

  await Promise.all(Object.values(imageFieldMap).flatMap((slotMap) => Object.values(slotMap).map(async (field) => {
    const previousFileName = previousConfig[field];
    const nextFileName = nextConfig[field];
    if (typeof previousFileName !== "string" || previousFileName.length === 0) return;
    if (previousFileName === nextFileName || nextImageNames.has(previousFileName)) return;
    if (!isSafeFileName(previousFileName)) return;

    await safeUnlink(getImageFilePath(guildId, previousFileName));
  })));
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

    const config = await GreetingsConfig.findOne({ guildId: String(guildId) });
    return NextResponse.json(config ? config.toObject() : getDefaultConfig(guildId));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const writtenImagePaths: string[] = [];

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    if (!isSafeGuildId(guildId)) {
      return NextResponse.json({ error: "Invalid guildId" }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    const formData = isMultipart ? await request.formData() : null;
    const rawConfig = formData
      ? parseJson(typeof formData.get("config") === "string" ? String(formData.get("config")) : null)
      : await request.json();
    const payload = buildConfigPayload(rawConfig);

    await connectDB();
    const previousConfig = await GreetingsConfig.findOne({ guildId: String(guildId) }).lean() as Record<string, unknown> | null;

    if (formData) {
      writtenImagePaths.push(...await savePendingImages(guildId, formData, payload));
    }

    const config = await GreetingsConfig.findOneAndUpdate(
      { guildId: String(guildId) },
      {
        ...payload,
        guildId: String(guildId),
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    if (formData) {
      await applyGifState(guildId, session.user.id, formData);
    }

    const nextConfig = config.toObject() as Record<string, unknown>;
    await cleanupReplacedImages(guildId, previousConfig, nextConfig);

    return NextResponse.json({
      config: nextConfig,
      gifs: await getGifItems(guildId),
    });
  } catch (error) {
    await Promise.all(writtenImagePaths.map(safeUnlink));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
