import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const DEFAULT_MESSAGE =
  '### Cześć i czołem! <a:pepo_howody:1351311201614827583>  \n' +
  'Pomóżcie nam rosnąć w siłę! Zostawcie szczerą recenzję o naszym serwerze na Disboardzie. \n' +
  'Każda opinia – niezależnie od tego, czy pozytywna, czy negatywna – jest dla nas bardzo cenna. \n\n' +
  '**Z góry dziękuję każdemu, kto znajdzie chwilę, by pomóc.** <:pepe_ok:1351199540304285726> \n' +
  '**Link do zamieszczenia recenzji:** https://disboard.org/pl/server/881293681783623680\n' +
  '-# Dla każdego, kto zdecyduje się napisać swoją opinię i zgłosi się do administracji serwera, przewidziano jednorazową nagrodę w postaci bonusu +5.000 XP.';

const disboardConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    message: { type: String, default: DEFAULT_MESSAGE },
    lastSentAt: { type: Date, default: null },
    nextSendAt: { type: Date, default: null },
  },
  { collection: 'disboardconfigs' },
);

if (mongoose.models.DisboardConfig) {
  delete mongoose.models.DisboardConfig;
}

const DisboardConfig = mongoose.model('DisboardConfig', disboardConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    await connectDB();

    const config = await DisboardConfig.findOne({ guildId });

    return NextResponse.json(
      config
        ? config.toObject()
        : { guildId, enabled: false, channelId: '', message: DEFAULT_MESSAGE, lastSentAt: null, nextSendAt: null },
    );
  } catch (error) {
    console.error('Error fetching disboard config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const body = await request.json();
    const { enabled, channelId, message } = body;

    await connectDB();

    const result = await DisboardConfig.findOneAndUpdate(
      { guildId },
      {
        guildId,
        enabled: enabled ?? false,
        channelId: channelId ?? '',
        message: message ?? DEFAULT_MESSAGE,
      },
      { upsert: true, new: true },
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating disboard config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
