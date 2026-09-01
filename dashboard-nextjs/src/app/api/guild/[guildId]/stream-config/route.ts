import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';

/** Musi być identyczny z src/models/StreamConfiguration.ts (bot) — patrz komentarz tam. */
const DEFAULT_STREAM_MESSAGE_TEMPLATE = '@everyone {streamer} właśnie zaczął streama! {link}';

const streamConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  channelId: { type: String, required: true },
  messageTemplate: { type: String, default: DEFAULT_STREAM_MESSAGE_TEMPLATE },
}, {
  collection: 'streamconfigurations'
});

if (mongoose.models.StreamConfiguration) {
  delete mongoose.models.StreamConfiguration;
}

const StreamConfiguration = mongoose.model('StreamConfiguration', streamConfigSchema);

const streamNotificationLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  twitchChannel: { type: String, required: true },
  sentAt: { type: Date, required: true },
}, {
  collection: 'streamnotificationlogs'
});

const StreamNotificationLog =
  mongoose.models.StreamNotificationLog ||
  mongoose.model('StreamNotificationLog', streamNotificationLogSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  req: NextRequest,
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
    const config = await StreamConfiguration.findOne({ guildId }).lean();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    // mongoose.trusted(): sanitizeFilter (instrumentation.ts) sanityzuje każdy
    // operator w ręcznie pisanym filtrze — bez tego rzuca CastError na $gte.
    const notificationsThisMonth = await StreamNotificationLog.countDocuments({
      guildId,
      sentAt: mongoose.trusted({ $gte: startOfMonth }),
    });

    // Uwaga: pusty string to CELOWY, poprawny stan (użytkownik chce wysyłać samo embed bez
    // treści nad nim) — fallback na domyślny szablon stosujemy TYLKO gdy pole faktycznie
    // nie istnieje (np. stara konfiguracja sprzed dodania tego pola), nie przy `|| ...`.
    const savedTemplate = (config as { messageTemplate?: string } | null)?.messageTemplate;

    return NextResponse.json({
      ...(config || { guildId, enabled: false, channelId: null }),
      messageTemplate: typeof savedTemplate === 'string' ? savedTemplate : DEFAULT_STREAM_MESSAGE_TEMPLATE,
      notificationsThisMonth,
    });
  } catch (error) {
    console.error('Error fetching stream config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
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

    const { enabled, channelId, messageTemplate } = await req.json();

    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
    }

    // Pusty string zapisujemy tak jak jest (świadomy wybór użytkownika — brak treści nad
    // embedem). Domyślny szablon wstawiamy tylko gdy pole w ogóle nie zostało przysłane.
    const messageTemplateToSave =
      typeof messageTemplate === 'string' ? messageTemplate.trim() : DEFAULT_STREAM_MESSAGE_TEMPLATE;

    await connectDB();
    const config = await StreamConfiguration.findOneAndUpdate(
      { guildId },
      {
        guildId,
        enabled: enabled !== undefined ? enabled : false,
        channelId,
        messageTemplate: messageTemplateToSave,
      },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error updating stream config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
