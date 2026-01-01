import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const streamConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  channelId: { type: String, required: true },
}, {
  collection: 'streamconfigurations'
});

if (mongoose.models.StreamConfiguration) {
  delete mongoose.models.StreamConfiguration;
}

const StreamConfiguration = mongoose.model('StreamConfiguration', streamConfigSchema);

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

    await connectDB();
    const config = await StreamConfiguration.findOne({ guildId }).lean();

    return NextResponse.json(config || { guildId, enabled: true, channelId: null });
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
    const { enabled, channelId } = await req.json();

    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
    }

    await connectDB();
    const config = await StreamConfiguration.findOneAndUpdate(
      { guildId },
      { guildId, enabled: enabled !== undefined ? enabled : true, channelId },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error updating stream config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;

    await connectDB();
    await StreamConfiguration.findOneAndDelete({ guildId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stream config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
