import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

// Mirrored 1:1 z src/models/BotStatus.ts po stronie bota — singleton (key='main')
// heartbeat zapisywany co ~20s z src/events/clientReady/botStatusHeartbeat.ts.
const BotStatusSchema = new mongoose.Schema({
  key: String,
  ping: Number,
  updatedAt: Date,
}, { collection: "botstatus", strict: false });
const BotStatus = mongoose.models.BotStatus || mongoose.model("BotStatus", BotStatusSchema);

// Heartbeat starszy niż to = traktujemy bota jako offline, nawet jeśli ostatni
// zapisany ping wyglądał dobrze.
const STALE_AFTER_MS = 90_000;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const doc = await BotStatus.findOne({ key: "main" }).lean<{ ping: number; updatedAt: Date } | null>();

    if (!doc) {
      return NextResponse.json({ online: false, ping: null });
    }

    const ageMs = Date.now() - new Date(doc.updatedAt).getTime();
    const online = ageMs <= STALE_AFTER_MS;

    return NextResponse.json({ online, ping: online ? doc.ping : null });
  } catch (error) {
    console.error("Error fetching bot status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
