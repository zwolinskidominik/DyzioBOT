import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const channelMultiplierSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  multiplier: { type: Number, required: true, min: 0.1, max: 10 }
}, { _id: false });

const levelConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelMultipliers: { type: [channelMultiplierSchema], default: [] }
});

if (mongoose.models.LevelConfig) {
  delete mongoose.models.LevelConfig;
}

const LevelConfig = mongoose.model('LevelConfig', levelConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
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
    await connectDB();
    
    const config = await LevelConfig.findOne({ guildId }).lean();
    
    return NextResponse.json(config?.channelMultipliers || []);
  } catch (error) {
    console.error('Error fetching channel multipliers:', error);
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
    const { channelId, multiplier } = await request.json();

    if (!channelId || typeof multiplier !== 'number') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    if (multiplier < 0.1 || multiplier > 10) {
      return NextResponse.json({ error: 'Multiplier must be between 0.1 and 10' }, { status: 400 });
    }

    await connectDB();

    await LevelConfig.findOneAndUpdate(
      { guildId },
      { $pull: { channelMultipliers: { channelId } } },
      { upsert: true }
    );

    await LevelConfig.findOneAndUpdate(
      { guildId },
      { $push: { channelMultipliers: { channelId, multiplier } } },
      { upsert: true }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding channel multiplier:', error);
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
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channelId' }, { status: 400 });
    }

    await connectDB();
    
    await LevelConfig.findOneAndUpdate(
      { guildId },
      { $pull: { channelMultipliers: { channelId } } }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting channel multiplier:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
