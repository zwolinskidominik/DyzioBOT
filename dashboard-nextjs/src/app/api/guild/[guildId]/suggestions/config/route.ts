import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const VOTING_FORMATS = ['counts', 'percent', 'bar'] as const;
type VotingFormat = (typeof VOTING_FORMATS)[number];
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const suggestionConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  suggestionChannelId: { type: String, required: true },
  votingFormat: { type: String, enum: VOTING_FORMATS, default: 'bar' },
  anonymous: { type: Boolean, default: false },
  embedColor: { type: String, default: '#4C4C54' },
}, {
  collection: 'suggestionconfigurations'
});

if (mongoose.models.SuggestionConfig) {
  delete mongoose.models.SuggestionConfig;
}

const SuggestionConfig = mongoose.model('SuggestionConfig', suggestionConfigSchema);

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
    
    const config = await SuggestionConfig.findOne({ guildId });

    return NextResponse.json(
      config
        ? config.toObject()
        : {
            guildId,
            enabled: false,
            suggestionChannelId: '',
            votingFormat: 'bar',
            anonymous: false,
            embedColor: '#4C4C54',
          }
    );
  } catch (error) {
    console.error('Error fetching suggestions config:', error);
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
    const { enabled, suggestionChannelId, votingFormat, anonymous, embedColor } = body;

    const sanitizedVotingFormat: VotingFormat = VOTING_FORMATS.includes(votingFormat)
      ? votingFormat
      : 'bar';
    const sanitizedEmbedColor =
      typeof embedColor === 'string' && HEX_COLOR_PATTERN.test(embedColor) ? embedColor : '#4C4C54';

    await connectDB();

    const result = await SuggestionConfig.findOneAndUpdate(
      { guildId },
      {
        guildId,
        enabled: enabled !== undefined ? enabled : false,
        suggestionChannelId,
        votingFormat: sanitizedVotingFormat,
        anonymous: anonymous === true,
        embedColor: sanitizedEmbedColor,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating suggestions config:', error);
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
    
    await SuggestionConfig.findOneAndDelete({ guildId });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting suggestions config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
