import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

// Mirrored 1:1 z src/models/ActivityBucket.ts (bot) — kubełki 5-minutowe
// (bucketStart = Math.floor(ts/300_000)*300_000), TTL indeks kasuje wpisy starsze niż ~32 dni.
const activityBucketSchema = new mongoose.Schema(
  { guildId: String, userId: String, bucketStart: Date, msgCount: Number, vcMin: Number },
  { collection: "activitybuckets", strict: false }
);
const ActivityBucket = mongoose.models.ActivityBucket || mongoose.model("ActivityBucket", activityBucketSchema);

// Mirrored 1:1 z src/models/InviteEntry.ts (bot) — wpis powstaje TYLKO gdy moduł
// Invite Tracker jest włączony dla gildii (patrz events/guildMemberAdd/inviteTracker.ts),
// więc dla gildii bez tego modułu "Dołączenia" będą realnie puste (0), nie błędem.
const inviteEntrySchema = new mongoose.Schema(
  { guildId: String, joinedUserId: String, joinedAt: Date },
  { collection: "inviteentries", strict: false }
);
const InviteEntry = mongoose.models.InviteEntry || mongoose.model("InviteEntry", inviteEntrySchema);

const DAYS = 30;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(
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

    await connectDB();

    const now = new Date();
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - (DAYS - 1));
    since.setUTCHours(0, 0, 0, 0);

    const [buckets, joins] = await Promise.all([
      ActivityBucket.find({ guildId, bucketStart: mongoose.trusted({ $gte: since }) })
        .select({ bucketStart: 1, msgCount: 1, vcMin: 1, _id: 0 })
        .lean<{ bucketStart: Date; msgCount: number; vcMin: number }[]>(),
      InviteEntry.find({ guildId, joinedAt: mongoose.trusted({ $gte: since }) })
        .select({ joinedAt: 1, _id: 0 })
        .lean<{ joinedAt: Date }[]>(),
    ]);

    const perDay = new Map<string, { messages: number; voice: number; joins: number }>();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      perDay.set(dayKey(d), { messages: 0, voice: 0, joins: 0 });
    }

    for (const b of buckets) {
      const entry = perDay.get(dayKey(new Date(b.bucketStart)));
      if (entry) {
        entry.messages += b.msgCount || 0;
        entry.voice += b.vcMin || 0;
      }
    }
    for (const j of joins) {
      const entry = perDay.get(dayKey(new Date(j.joinedAt)));
      if (entry) entry.joins += 1;
    }

    const todayKey = dayKey(now);
    const days = Array.from(perDay.entries()).map(([date, v]) => ({
      date,
      label: `${date.slice(8, 10)}.${date.slice(5, 7)}`,
      isToday: date === todayKey,
      ...v,
    }));

    return NextResponse.json({ days });
  } catch (error) {
    console.error("Error fetching daily activity:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
