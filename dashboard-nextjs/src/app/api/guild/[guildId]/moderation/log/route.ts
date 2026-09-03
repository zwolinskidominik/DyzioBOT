import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import { resolveDiscordUsers } from '@/lib/discordUsers';
import mongoose, { FilterQuery } from 'mongoose';
import { z } from 'zod';

// Kształt musi odzwierciedlać bot/src/models/ModerationLog.ts i Warn.ts (osobny
// projekt npm — bez cross-project importu, zgodnie z konwencją reszty dashboardu).
const moderationLogSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    kind: { type: String, required: true },
    targetId: { type: String, required: true },
    targetTag: { type: String, required: true },
    moderatorId: { type: String, required: true },
    moderatorTag: { type: String, required: true },
    reason: { type: String, default: '' },
    extra: { type: String },
    warnEntryId: { type: String },
    undone: { type: Boolean, default: false },
  },
  { collection: 'moderationlogs', timestamps: true }
);

interface IModerationLog {
  _id: mongoose.Types.ObjectId;
  guildId: string;
  kind: 'ban' | 'kick' | 'mute' | 'warn' | 'clear';
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason: string;
  extra?: string;
  warnEntryId?: string;
  undone: boolean;
  createdAt: Date;
}

if (mongoose.models.ModerationLog) {
  delete mongoose.models.ModerationLog;
}
const ModerationLog = mongoose.model<IModerationLog>('ModerationLog', moderationLogSchema);

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
  { collection: 'warns' }
);
warnSchema.index({ userId: 1, guildId: 1 });

if (mongoose.models.Warn) {
  delete mongoose.models.Warn;
}
const Warn = mongoose.model('Warn', warnSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const KINDS = new Set(['ban', 'kick', 'mute', 'warn', 'clear']);
const DAY_RANGE_VALUES = new Set(['7', '30', '90', 'all']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const skip = parseInt(searchParams.get('skip') || '0');
    const kind = searchParams.get('kind');
    const q = searchParams.get('q')?.trim();
    const daysParam = searchParams.get('days');
    const days = daysParam && DAY_RANGE_VALUES.has(daysParam) ? daysParam : 'all';

    const query: FilterQuery<IModerationLog> = { guildId };
    if (kind && KINDS.has(kind)) query.kind = kind as IModerationLog['kind'];

    if (days !== 'all') {
      const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
      // mongoose.trusted(): sanitizeFilter sanityzuje każdy operator w ręcznie
      // pisanym filtrze — bez tego rzuca CastError na $gte.
      query.createdAt = mongoose.trusted({ $gte: since });
    }

    if (q) {
      const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { targetTag: searchRegex },
        { moderatorTag: searchRegex },
        { reason: searchRegex },
      ];
    }

    const [logs, total] = await Promise.all([
      ModerationLog.find(query).sort({ createdAt: -1 }).limit(limit).skip(skip).lean(),
      ModerationLog.countDocuments(query),
    ]);

    // 'clear' ma targetId = nazwa kanału, nie user ID — nie ma sensu dociągać z Discorda.
    const userTargetIds = logs.filter((l) => l.kind !== 'clear').map((l) => l.targetId);
    const users = await resolveDiscordUsers(guildId, userTargetIds);

    const enriched = logs.map((log) => {
      const user = log.kind !== 'clear' ? users.get(log.targetId) ?? null : null;
      return {
        ...log,
        targetAvatar: user?.avatar ?? null,
        targetUsername: user ? (user.globalName ?? user.username) : null,
      };
    });

    return NextResponse.json({ logs: enriched, total });
  } catch (error) {
    console.error('Error fetching moderation log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const undoZod = z.object({
  logId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const rawBody = await request.json();
    const parsed = undoZod.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();

    // IDOR: zapytanie scope'owane do guildId z URL-a — bez tego dowolny dashboard
    // user mógłby cofnąć karę na innym serwerze, znając samo ObjectId.
    const log = await ModerationLog.findOne({ _id: parsed.data.logId, guildId });
    if (!log) {
      return NextResponse.json({ error: 'Nie znaleziono wpisu.' }, { status: 404 });
    }
    if (log.undone) {
      return NextResponse.json({ error: 'Ta kara została już cofnięta.' }, { status: 400 });
    }

    switch (log.kind) {
      case 'ban': {
        const response = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/bans/${log.targetId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
          }
        );
        if (!response.ok && response.status !== 404) {
          const errText = await response.text();
          console.error('Discord API error (unban):', errText);
          return NextResponse.json({ error: 'Nie udało się odbanować użytkownika.' }, { status: 502 });
        }
        // Tak jak /unban w bocie — oznacza WSZYSTKIE aktywne wpisy 'ban' tego usera jako cofnięte.
        await ModerationLog.updateMany(
          { guildId, kind: 'ban', targetId: log.targetId, undone: false },
          { $set: { undone: true } }
        );
        break;
      }

      case 'mute': {
        const response = await fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${log.targetId}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ communication_disabled_until: null }),
          }
        );
        if (!response.ok && response.status !== 404) {
          const errText = await response.text();
          console.error('Discord API error (unmute):', errText);
          return NextResponse.json({ error: 'Nie udało się zdjąć wyciszenia.' }, { status: 502 });
        }
        log.undone = true;
        await log.save();
        break;
      }

      case 'warn': {
        if (!log.warnEntryId) {
          return NextResponse.json({ error: 'Brak powiązanego wpisu ostrzeżenia.' }, { status: 400 });
        }
        const result = await Warn.updateOne(
          { guildId, userId: log.targetId },
          { $pull: { warnings: { _id: log.warnEntryId } } }
        );
        if (result.modifiedCount === 0) {
          return NextResponse.json(
            { error: 'Ostrzeżenie już nie istnieje (mogło wygasnąć lub zostać usunięte wcześniej).' },
            { status: 404 }
          );
        }
        log.undone = true;
        await log.save();
        break;
      }

      case 'kick':
      case 'clear':
      default:
        return NextResponse.json({ error: 'Tej akcji nie da się cofnąć.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error undoing moderation action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
