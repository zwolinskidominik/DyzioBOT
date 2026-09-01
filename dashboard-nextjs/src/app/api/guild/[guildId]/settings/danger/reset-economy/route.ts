import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildOwner } from "@/lib/requireGuildOwner";
import { createAuditLog } from "@/lib/auditLog";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// Kształt musi odzwierciedlać bot/src/models/Economy.ts i EconomyTransaction.ts
// (osobny projekt npm — bez cross-project importu, zgodnie z konwencją reszty
// dashboardu). "NIGDY nie aktualizuj salda bezpośrednio — zawsze przez
// EconomyTransaction" (CLAUDE.md) — reset też zapisuje wpis do ledgera (type: RESET).
const economySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    wallet: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    netWorth: { type: Number, default: 0 },
  },
  { collection: "economies" }
);
economySchema.index({ guildId: 1, userId: 1 }, { unique: true });

const economyTransactionSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    walletAfter: { type: Number, required: true },
    bankAfter: { type: Number, required: true },
  },
  { collection: "economy_transactions", timestamps: true }
);

if (mongoose.models.Economy) {
  delete mongoose.models.Economy;
}
const Economy = mongoose.model("Economy", economySchema);

if (mongoose.models.EconomyTransaction) {
  delete mongoose.models.EconomyTransaction;
}
const EconomyTransaction = mongoose.model("EconomyTransaction", economyTransactionSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

interface IEconomyAccount {
  _id: mongoose.Types.ObjectId;
  guildId: string;
  userId: string;
  wallet: number;
  bank: number;
  netWorth: number;
}

/**
 * NIEBEZPIECZNA FUNKCJA — zeruje portfel i bank WSZYSTKICH użytkowników na
 * serwerze. Dostępna wyłącznie dla realnego właściciela tego serwera Discord
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

    const accounts = await Economy.find({ guildId }).lean<IEconomyAccount[]>();
    const affected = accounts.filter((a) => a.wallet !== 0 || a.bank !== 0 || a.netWorth !== 0);

    if (affected.length > 0) {
      const now = new Date();

      await EconomyTransaction.insertMany(
        affected.map((a) => ({
          guildId,
          userId: a.userId,
          type: "RESET",
          amount: -(a.wallet + a.bank),
          walletAfter: 0,
          bankAfter: 0,
          createdAt: now,
        }))
      );

      await Economy.bulkWrite(
        affected.map((a) => ({
          updateOne: {
            filter: { _id: a._id },
            update: { $set: { wallet: 0, bank: 0, netWorth: 0 } },
          },
        }))
      );
    }

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || "unknown",
      username: session.user.name || session.user.email || "Unknown User",
      action: "settings.danger.resetEconomy",
      module: "settings",
      description: `Wyzerowano saldo WSZYSTKICH użytkowników na serwerze (${affected.length} kont)`,
      metadata: { usersAffected: affected.length },
    });

    return NextResponse.json({ success: true, usersAffected: affected.length });
  } catch (error) {
    console.error("Error resetting economy:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
