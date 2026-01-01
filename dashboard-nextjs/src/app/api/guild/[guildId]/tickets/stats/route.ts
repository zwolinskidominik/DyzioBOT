import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const ticketStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  count: { type: Number, default: 0 },
}, {
  collection: 'ticketstats'
});

if (mongoose.models.TicketStats) {
  delete mongoose.models.TicketStats;
}

const TicketStats = mongoose.model('TicketStats', ticketStatsSchema);

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
    
    const stats = await TicketStats.find({ guildId }).sort({ count: -1 }).limit(10).lean();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
