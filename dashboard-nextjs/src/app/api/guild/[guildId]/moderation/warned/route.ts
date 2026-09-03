import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import { resolveDiscordUsers } from '@/lib/discordUsers';
import mongoose from 'mongoose';
import { z } from 'zod';

// Kształt musi odzwierciedlać bot/src/models/Warn.ts (osobny projekt npm — bez
// cross-project importu, zgodnie z konwencją reszty dashboardu).
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

if (mongoose.models.ModerationLog) {
  delete mongoose.models.ModerationLog;
}
const ModerationLog = mongoose.model('ModerationLog', moderationLogSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

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
    const q = searchParams.get('q')?.trim();

    const matchStage: Record<string, unknown> = { guildId };

    const pipeline: mongoose.PipelineStage[] = [
      { $match: matchStage },
      { $unwind: '$warnings' },
    ];

    if (q) {
      const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push({
        $match: {
          $or: [{ userId: q }, { 'warnings.reason': searchRegex }],
        },
      });
    }

    pipeline.push({ $sort: { 'warnings.date': -1 } });

    const [rows, totalResult] = await Promise.all([
      Warn.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            userId: 1,
            warnEntryId: '$warnings._id',
            reason: '$warnings.reason',
            date: '$warnings.date',
            moderatorId: '$warnings.moderatorId',
            moderatorTag: '$warnings.moderatorTag',
          },
        },
      ]),
      Warn.aggregate([...pipeline, { $count: 'total' }]),
    ]);

    const total = totalResult[0]?.total ?? 0;

    // Ile aktywnych ostrzeżeń ma łącznie każdy user widoczny na tej stronie —
    // do wyświetlenia np. "3/4" przy wpisie.
    const pageUserIds = Array.from(new Set(rows.map((r) => r.userId as string)));
    const counts = await Warn.aggregate([
      { $match: { guildId, userId: { $in: pageUserIds } } },
      { $project: { userId: 1, count: { $size: '$warnings' } } },
    ]);
    const countByUser = new Map(counts.map((c) => [c.userId as string, c.count as number]));

    const users = await resolveDiscordUsers(guildId, rows.map((r) => r.userId as string));

    // Stare wpisy Anti-Spam mogły zapisać żywy tag bota z Discorda (np. "Test#0229")
    // zamiast stałej etykiety — nadpisujemy przy odczycie, żeby zmiana nazwy bota
    // (np. przez Ustawienia → Profil) nie zostawiała nieaktualnych tagów w historii.
    const botUserId = process.env.DISCORD_CLIENT_ID;

    const enriched = rows.map((row) => {
      const user = users.get(row.userId as string) ?? null;
      return {
        ...row,
        moderatorTag:
          botUserId && row.moderatorId === botUserId ? "Anti-Spam (automatycznie)" : row.moderatorTag,
        totalForUser: countByUser.get(row.userId as string) ?? 1,
        username: user ? (user.globalName ?? user.username) : null,
        avatar: user?.avatar ?? null,
      };
    });

    return NextResponse.json({ warnings: enriched, total });
  } catch (error) {
    console.error('Error fetching active warnings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const deleteWarnZod = z.object({
  userId: z.string().min(1),
  warnEntryId: z.string().min(1),
});

export async function DELETE(
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
    const parsed = deleteWarnZod.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { userId, warnEntryId } = parsed.data;

    await connectDB();

    const result = await Warn.updateOne(
      { guildId, userId },
      { $pull: { warnings: { _id: warnEntryId } } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 });
    }
    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Nie znaleziono tego ostrzeżenia.' }, { status: 404 });
    }

    await ModerationLog.updateMany(
      { guildId, kind: 'warn', warnEntryId, undone: false },
      { $set: { undone: true } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing warning:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
