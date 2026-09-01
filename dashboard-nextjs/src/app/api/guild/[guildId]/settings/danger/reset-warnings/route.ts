import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildOwner } from "@/lib/requireGuildOwner";
import { createAuditLog } from "@/lib/auditLog";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// Kształt musi odzwierciedlać bot/src/models/Warn.ts (osobny projekt npm —
// bez cross-project importu, zgodnie z konwencją reszty dashboardu, patrz
// moderation/warned/route.ts).
const warnEntrySchema = new mongoose.Schema(
  {
    reason: { type: String, required: true },
    date: { type: Date, default: Date.now },
    moderatorId: { type: String, required: true },
    moderatorTag: { type: String },
  },
  { _id: true }
);

const warnSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    warnings: { type: [warnEntrySchema], default: [] },
  },
  { collection: "warns" }
);
warnSchema.index({ userId: 1, guildId: 1 });

if (mongoose.models.Warn) {
  delete mongoose.models.Warn;
}
const Warn = mongoose.model("Warn", warnSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

/**
 * NIEBEZPIECZNA FUNKCJA — usuwa WSZYSTKIE ostrzeżenia WSZYSTKICH użytkowników
 * na serwerze. Dostępna wyłącznie dla realnego właściciela tego serwera Discord
 * (requireGuildOwner, BEZ bypassu dla właściciela bota).
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

    const result = await Warn.deleteMany({ guildId });

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || "unknown",
      username: session.user.name || session.user.email || "Unknown User",
      action: "settings.danger.resetWarnings",
      module: "settings",
      description: `Zresetowano ostrzeżenia WSZYSTKICH użytkowników na serwerze (usunięto ${result.deletedCount} rekordów)`,
      metadata: { deletedCount: result.deletedCount },
    });

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Error resetting warnings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
