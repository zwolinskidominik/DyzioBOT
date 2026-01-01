import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const twitchStreamerSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  twitchChannel: { type: String, required: true, lowercase: true, trim: true },
  userId: { type: String, required: true },
  isLive: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, {
  collection: 'twitchstreamers'
});

if (mongoose.models.TwitchStreamer) {
  delete mongoose.models.TwitchStreamer;
}

const TwitchStreamer = mongoose.model('TwitchStreamer', twitchStreamerSchema);

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
    const streamers = await TwitchStreamer.find({ guildId, active: true }).lean();

    return NextResponse.json(streamers);
  } catch (error) {
    console.error('Error fetching streamers:', error);
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
    const { twitchChannel, userId } = await req.json();

    if (!twitchChannel || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();
    
    // Check if streamer already exists for this user
    const existing = await TwitchStreamer.findOne({ guildId, userId });
    
    if (existing) {
      // Update existing streamer
      existing.twitchChannel = twitchChannel.toLowerCase().trim();
      existing.active = true;
      await existing.save();
      return NextResponse.json(existing.toObject());
    }
    
    // Create new streamer
    const streamer = await TwitchStreamer.create({
      guildId,
      twitchChannel: twitchChannel.toLowerCase().trim(),
      userId,
      isLive: false,
      active: true,
    });

    return NextResponse.json(streamer.toObject());
  } catch (error) {
    console.error('Error creating streamer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const { streamerId, twitchChannel, userId } = await req.json();

    if (!streamerId || !twitchChannel || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();
    
    const streamer = await TwitchStreamer.findByIdAndUpdate(
      streamerId,
      { 
        twitchChannel: twitchChannel.toLowerCase().trim(), 
        userId 
      },
      { new: true }
    );

    if (!streamer) {
      return NextResponse.json({ error: 'Streamer not found' }, { status: 404 });
    }

    return NextResponse.json(streamer.toObject());
  } catch (error) {
    console.error('Error updating streamer:', error);
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
    const { searchParams } = new URL(req.url);
    const streamerId = searchParams.get('streamerId');

    if (!streamerId) {
      return NextResponse.json({ error: 'Missing streamerId' }, { status: 400 });
    }

    await connectDB();
    
    await TwitchStreamer.findByIdAndDelete(streamerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting streamer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
