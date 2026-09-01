import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
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

/**
 * Dociąga hash awatara z Discord API dla podanych userId (dedupe + równolegle).
 * Błąd pojedynczego usera (np. konto usunięte) nie wywala reszty — dostaje `null`,
 * front i tak ma fallback na domyślny awatar Discorda (`getAvatarUrl`).
 */
async function resolveAvatars(userIds: string[]): Promise<Map<string, string | null>> {
  const uniqueIds = Array.from(new Set(userIds));
  const result = new Map<string, string | null>();

  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const response = await fetch(`https://discord.com/api/v10/users/${id}`, {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        });
        if (response.ok) {
          const user = await response.json();
          result.set(id, user.avatar ?? null);
        } else {
          result.set(id, null);
        }
      } catch {
        result.set(id, null);
      }
    })
  );

  return result;
}

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
    const limit = parseInt(searchParams.get('limit') || '50');
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

    const avatars = await resolveAvatars(logs.map((log) => log.userId));
    const logsWithAvatars = logs.map((log) => ({
      ...log,
      avatar: avatars.get(log.userId) ?? null,
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
