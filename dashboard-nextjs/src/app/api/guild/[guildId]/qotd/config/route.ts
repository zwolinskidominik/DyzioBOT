import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import { z } from 'zod';
import { optionalSnowflake, parseJsonBody } from '@/lib/apiValidation';
import { requireChannelsInGuild } from '@/lib/guildChannels';

const questionConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  questionChannelId: { type: String, required: true },
  pingRoleId: { type: String },
}, {
  collection: 'questionconfigurations'
});

if (mongoose.models.QuestionConfig) {
  delete mongoose.models.QuestionConfig;
}

const QuestionConfig = mongoose.model('QuestionConfig', questionConfigSchema);

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

    const config = await QuestionConfig.findOne({ guildId });
    
    return NextResponse.json(config ? config.toObject() : { guildId, enabled: false, questionChannelId: '', pingRoleId: '' });
  } catch (error) {
    console.error('Error fetching QOTD config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const qotdConfigBody = z.object({
  enabled: z.boolean().optional(),
  questionChannelId: optionalSnowflake,
  pingRoleId: optionalSnowflake,
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

    const body = await parseJsonBody(request, qotdConfigBody);
    if (!body.ok) return body.response;
    const { enabled, questionChannelId, pingRoleId } = body.data;

    const channelError = await requireChannelsInGuild(guildId, [questionChannelId]);
    if (channelError) return channelError;

    await connectDB();
    
    const result = await QuestionConfig.findOneAndUpdate(
      { guildId },
      { 
        guildId,
        enabled: enabled !== undefined ? enabled : false,
        questionChannelId,
        pingRoleId: pingRoleId || undefined
      },
      { upsert: true, returnDocument: 'after' }
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating QOTD config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
