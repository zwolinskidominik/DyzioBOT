import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const suggestionSchema = new mongoose.Schema({
  suggestionId: { type: String, default: () => crypto.randomUUID() },
  authorId: { type: String, required: true },
  guildId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  upvotes: { type: [String], default: [] },
  upvoteUsernames: { type: [String], default: [] },
  downvotes: { type: [String], default: [] },
  downvoteUsernames: { type: [String], default: [] },
}, {
  collection: 'suggestions'
});

if (mongoose.models.Suggestion) {
  delete mongoose.models.Suggestion;
}

const Suggestion = mongoose.model('Suggestion', suggestionSchema);

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
    
    const suggestions = await Suggestion.find({ guildId }).sort({ _id: -1 }).lean();
    
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
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

    const { searchParams } = new URL(request.url);
    const suggestionId = searchParams.get('suggestionId');

    if (!suggestionId) {
      return NextResponse.json({ error: 'Missing suggestionId' }, { status: 400 });
    }

    await connectDB();
    
    await Suggestion.findOneAndDelete({ suggestionId });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting suggestion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
