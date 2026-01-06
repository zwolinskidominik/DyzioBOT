import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

const monthlyStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  month: { type: String, required: true },
  messageCount: { type: Number, default: 0 },
  voiceMinutes: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'monthlystats'
});

if (mongoose.models.MonthlyStats) {
  delete mongoose.models.MonthlyStats;
}

const MonthlyStats = mongoose.model('MonthlyStats', monthlyStatsSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const { guildId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '25');
    const currentMonth = getCurrentMonth();

    await connectDB();

    const stats = await MonthlyStats
      .find({ guildId, month: currentMonth })
      .sort({ messageCount: -1, voiceMinutes: -1 })
      .limit(limit)
      .lean();

    const enrichedStats = stats.map((stat, index) => ({
      userId: stat.userId,
      messageCount: stat.messageCount,
      voiceMinutes: stat.voiceMinutes,
      totalActivity: stat.messageCount + Math.floor(stat.voiceMinutes / 10),
      rank: index + 1,
    }));

    return NextResponse.json({
      month: currentMonth,
      stats: enrichedStats,
      total: stats.length,
    });
  } catch (error) {
    console.error('Error fetching current monthly stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current monthly stats' },
      { status: 500 }
    );
  }
}
