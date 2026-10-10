import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";
import BotStatus, { BOT_HEARTBEAT_STALE_MS } from "@/models/BotStatus";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

// Heartbeat starszy niż BOT_HEARTBEAT_STALE_MS = bot offline, nawet jeśli ostatni zapisany ping
// wyglądał dobrze. Model i próg są wspólne z publicznym /api/health.
const STALE_AFTER_MS = BOT_HEARTBEAT_STALE_MS;

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
