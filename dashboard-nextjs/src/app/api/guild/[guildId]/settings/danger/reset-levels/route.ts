import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildOwner } from "@/lib/requireGuildOwner";
import { createAuditLog } from "@/lib/auditLog";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// Kształt musi odzwierciedlać bot/src/models/Level.ts (osobny projekt npm —
// bez cross-project importu, zgodnie z konwencją reszty dashboardu).
const levelSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
  },
  { collection: "levels" }
);
levelSchema.index({ guildId: 1, userId: 1 }, { unique: true });

if (mongoose.models.Level) {
  delete mongoose.models.Level;
}
const Level = mongoose.model("Level", levelSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

/**
 * NIEBEZPIECZNA FUNKCJA — usuwa poziomy/XP WSZYSTKICH użytkowników na serwerze.
 * Dostępna wyłącznie dla realnego właściciela tego serwera Discord (requireGuildOwner,
 * BEZ bypassu dla właściciela bota) — patrz moduł Ustawienia w dashboardzie.
 */
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
    const ownerError = await requireGuildOwner(session, guildId);
    if (ownerError) return ownerError;

    await connectDB();

    const result = await Level.deleteMany({ guildId });

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || "unknown",
      username: session.user.name || session.user.email || "Unknown User",
      action: "settings.danger.resetLevels",
      module: "settings",
      description: `Zresetowano poziomy WSZYSTKICH użytkowników na serwerze (usunięto ${result.deletedCount} rekordów)`,
      metadata: { deletedCount: result.deletedCount },
    });

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Error resetting levels:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
