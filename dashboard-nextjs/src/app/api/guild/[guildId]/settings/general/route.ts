import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import { createAuditLog, diffFields } from "@/lib/auditLog";
import GuildSettings from "@/models/GuildSettings";
import mongoose from "mongoose";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Whitelist pól POST-a — blokuje mass assignment. Kształt musi odzwierciedlać
// bot/src/models/GuildSettings.ts (osobny projekt npm — bez cross-project importu).
const generalSettingsZod = z
  .object({
    // Tylko 'pl' jest obecnie realnie obsługiwane — 'en' zarezerwowane na przyszłość.
    language: z.literal("pl"),
    systemNotifyChannelId: z.string().optional(),
  })
  .partial();

interface IGuildSettings {
  guildId: string;
  language: string;
  systemNotifyChannelId?: string;
}

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const DEFAULT_SETTINGS = { language: "pl" as const };

export async function GET(
  request: NextRequest,
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

    await connectDB();

    const settings = await GuildSettings.findOne({ guildId }).lean();

    return NextResponse.json(settings ? settings : { guildId, ...DEFAULT_SETTINGS });
  } catch (error) {
    console.error("Error fetching guild settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const rawBody = await request.json();
    const parsed = generalSettingsZod.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Nieprawidłowe dane", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();

    const oldSettings = await GuildSettings.findOne({ guildId }).lean<IGuildSettings>();

    const result = await GuildSettings.findOneAndUpdate(
      { guildId },
      { guildId, ...parsed.data },
      { upsert: true, new: true }
    ).lean<IGuildSettings>();

    const changes = diffFields(oldSettings, result!, [
      { field: "language", label: "Język bota" },
      { field: "systemNotifyChannelId", label: "Kanał powiadomień systemowych" },
    ]);

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || "unknown",
      username: session.user.name || session.user.email || "Unknown User",
      action: "settings.general.update",
      module: "settings",
      description: "Zaktualizowano ustawienia ogólne serwera",
      changes,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error saving guild settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
