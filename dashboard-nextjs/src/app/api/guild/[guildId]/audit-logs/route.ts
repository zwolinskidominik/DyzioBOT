import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import { resolveDiscordUsers } from "@/lib/discordUsers";
import mongoose, { FilterQuery } from "mongoose";
import AuditLogModel, { IAuditLog } from "@/models/AuditLog";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

/** Dozwolone wartości `days` — 'all' pomija filtr zakresu dat. */
const DAY_RANGE_VALUES = new Set(['7', '30', '90', 'all']);

export async function GET(
  req: NextRequest,
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

    const { searchParams } = new URL(req.url);
    // Cap, tak jak w moderation/warned i moderation/log — nieograniczony limit
    // to nieograniczona liczba userId do rozwiązania z Discord API per request.
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const skip = parseInt(searchParams.get('skip') || '0');
    const module = searchParams.get('module');
    const userId = searchParams.get('userId');
    const q = searchParams.get('q')?.trim();
    const daysParam = searchParams.get('days');
    const days = daysParam && DAY_RANGE_VALUES.has(daysParam) ? daysParam : 'all';

    const query: FilterQuery<IAuditLog> = { guildId };
    if (module) query.module = module;
    if (userId) query.userId = userId;

    if (days !== 'all') {
      const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
      // mongoose.trusted(): sanitizeFilter (instrumentation.ts) sanityzuje każdy
      // operator w ręcznie pisanym filtrze — bez tego rzuca CastError na $gte.
      query.createdAt = mongoose.trusted({ $gte: since });
    }

    if (q) {
      const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { username: searchRegex },
        { description: searchRegex },
        { action: searchRegex },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLogModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      AuditLogModel.countDocuments(query),
    ]);

    const users = await resolveDiscordUsers(guildId, logs.map((log) => log.userId));
    const logsWithAvatars = logs.map((log) => ({
      ...log,
      avatar: users.get(log.userId)?.avatar ?? null,
    }));

    return NextResponse.json({ logs: logsWithAvatars, total });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
