import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

const musicConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  defaultVolume: { type: Number, default: 50 },
  maxQueueSize: { type: Number, default: 100 },
  maxSongDuration: { type: Number, default: 0 },
  djRoleId: { type: String, default: '' },
  allowedChannels: { type: [String], default: [] },
  announceSongs: { type: Boolean, default: true },
  leaveOnEmpty: { type: Boolean, default: true },
  leaveOnEnd: { type: Boolean, default: true },
  leaveTimeout: { type: Number, default: 300 },
  prefix: { type: String, default: '!' },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'musicconfigs'
});

if (mongoose.models.MusicConfig) {
  delete mongoose.models.MusicConfig;
}

const MusicConfig = mongoose.model('MusicConfig', musicConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const { guildId } = await params;
    await connectDB();

    const config = await MusicConfig.findOne({ guildId });

    if (!config) {
      return NextResponse.json({
        enabled: false,
        defaultVolume: 50,
        maxQueueSize: 100,
        maxSongDuration: 0,
        djRoleId: '',
        allowedChannels: [],
        announceSongs: true,
        leaveOnEmpty: true,
        leaveOnEnd: true,
        leaveTimeout: 300,
        prefix: '!',
      });
    }

    return NextResponse.json({
      enabled: config.enabled ?? false,
      defaultVolume: config.defaultVolume ?? 50,
      maxQueueSize: config.maxQueueSize ?? 100,
      maxSongDuration: config.maxSongDuration ?? 0,
      djRoleId: config.djRoleId ?? '',
      allowedChannels: config.allowedChannels ?? [],
      announceSongs: config.announceSongs ?? true,
      leaveOnEmpty: config.leaveOnEmpty ?? true,
      leaveOnEnd: config.leaveOnEnd ?? true,
      leaveTimeout: config.leaveTimeout ?? 300,
      prefix: config.prefix ?? '!',
    });
  } catch (error) {
    console.error('Error fetching music config:', error);
    return NextResponse.json({ error: 'Failed to fetch music config' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const { guildId } = await params;
    const body = await request.json();

    await connectDB();

    const rawPrefix = typeof body.prefix === 'string' ? body.prefix.trim() : '!';
    const prefix = rawPrefix.length > 0 && rawPrefix.length <= 5 ? rawPrefix : '!';

    const updateData = {
      guildId,
      enabled: body.enabled ?? true,
      defaultVolume: Math.max(0, Math.min(100, body.defaultVolume ?? 50)),
      maxQueueSize: Math.max(1, body.maxQueueSize ?? 100),
      maxSongDuration: Math.max(0, body.maxSongDuration ?? 0),
      djRoleId: body.djRoleId ?? '',
      allowedChannels: body.allowedChannels ?? [],
      announceSongs: body.announceSongs ?? true,
      leaveOnEmpty: body.leaveOnEmpty ?? true,
      leaveOnEnd: body.leaveOnEnd ?? true,
      leaveTimeout: Math.max(0, body.leaveTimeout ?? 300),
      prefix,
      updatedAt: new Date(),
    };

    await MusicConfig.updateOne(
      { guildId },
      { $set: updateData },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating music config:', error);
    return NextResponse.json({ error: 'Failed to update music config' }, { status: 500 });
  }
}
