import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const antiSpamConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    messageThreshold: { type: Number, default: 5 },
    timeWindowMs: { type: Number, default: 3000 },
    action: { type: String, default: 'timeout' },
    timeoutDurationMs: { type: Number, default: 300_000 },
    deleteMessages: { type: Boolean, default: true },
    ignoredChannels: { type: [String], default: [] },
    ignoredRoles: { type: [String], default: [] },
    blockInviteLinks: { type: Boolean, default: false },
    blockMassMentions: { type: Boolean, default: false },
    maxMentionsPerMessage: { type: Number, default: 5 },
    blockEveryoneHere: { type: Boolean, default: true },
    blockFlood: { type: Boolean, default: false },
    floodThreshold: { type: Number, default: 3 },
    floodWindowMs: { type: Number, default: 30_000 },
  },
  {
    collection: 'antispamconfigs',
    timestamps: true,
  }
);

if (mongoose.models.AntiSpamConfig) {
  delete mongoose.models.AntiSpamConfig;
}

const AntiSpamConfig = mongoose.model('AntiSpamConfig', antiSpamConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const DEFAULT_CONFIG = {
  enabled: false,
  messageThreshold: 5,
  timeWindowMs: 3000,
  action: 'timeout',
  timeoutDurationMs: 300_000,
  deleteMessages: true,
  ignoredChannels: [],
  ignoredRoles: [],
  blockInviteLinks: false,
  blockMassMentions: false,
  maxMentionsPerMessage: 5,
  blockEveryoneHere: true,
  blockFlood: false,
  floodThreshold: 3,
  floodWindowMs: 30_000,
};

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
    await connectDB();

    const config = await AntiSpamConfig.findOne({ guildId });

    return NextResponse.json(
      config ? config.toObject() : { guildId, ...DEFAULT_CONFIG }
    );
  } catch (error) {
    console.error('Error fetching anti-spam config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const body = await request.json();

    await connectDB();

    const result = await AntiSpamConfig.findOneAndUpdate(
      { guildId },
      { guildId, ...body },
      { upsert: true, new: true }
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating anti-spam config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    await connectDB();

    await AntiSpamConfig.findOneAndDelete({ guildId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting anti-spam config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
