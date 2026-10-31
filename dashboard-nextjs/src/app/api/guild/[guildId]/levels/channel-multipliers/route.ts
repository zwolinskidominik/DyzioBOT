import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import { z } from 'zod';
import { parseJsonBody, snowflake } from '@/lib/apiValidation';

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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const config = await LevelConfig.findOne({ guildId }).lean();
    
    return NextResponse.json(config?.channelMultipliers || []);
  } catch (error) {
    console.error('Error fetching channel multipliers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const channelMultiplierBody = z.object({
  channelId: snowflake,
  multiplier: z.number().min(0.1).max(10),
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

    // channelId trafia do $pull (dokument aktualizacji, którego sanitizeFilter nie sprawdza) -
    // musi być prawdziwym ID kanału, nie obiektem z operatorami Mongo.
    const body = await parseJsonBody(request, channelMultiplierBody);
    if (!body.ok) return body.response;
    const { channelId, multiplier } = body.data;

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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    if (!channelId || !snowflake.safeParse(channelId).success) {
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
