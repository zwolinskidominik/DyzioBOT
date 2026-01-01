import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

const levelSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  lastMessageTs: Date,
  lastVcUpdateTs: Date,
}, {
  collection: 'levels'
});

if (mongoose.models.Level) {
  delete mongoose.models.Level;
}

const Level = mongoose.model('Level', levelSchema);

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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    await connectDB();

    const users = await Level
      .find({ guildId })
      .sort({ level: -1, xp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Level.countDocuments({ guildId });

    return NextResponse.json({
      users,
      total,
      hasMore: skip + limit < total,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
