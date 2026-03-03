import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const InviteEntrySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  inviterId: { type: String, default: null },
  joinedUserId: { type: String, required: true },
  inviteCode: { type: String, default: null },
  active: { type: Boolean, default: true },
  fake: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
}, { collection: 'inviteentries' });

const InviteEntry = mongoose.models.InviteEntry ||
  mongoose.model('InviteEntry', InviteEntrySchema);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { guildId } = await params;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const skip = (page - 1) * limit;

    // Leaderboard aggregation
    const leaderboard = await InviteEntry.aggregate([
      { $match: { guildId, inviterId: { $ne: null } } },
      {
        $group: {
          _id: '$inviterId',
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$active', true] }, { $eq: ['$fake', false] }] },
                1,
                0,
              ],
            },
          },
          left: { $sum: { $cond: [{ $eq: ['$active', false] }, 1, 0] } },
          fake: { $sum: { $cond: [{ $eq: ['$fake', true] }, 1, 0] } },
        },
      },
      { $sort: { active: -1, total: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Total unique inviters count
    const totalInviters = await InviteEntry.distinct('inviterId', {
      guildId,
      inviterId: { $ne: null },
    });

    // Overall stats
    const totalEntries = await InviteEntry.countDocuments({ guildId });
    const totalActive = await InviteEntry.countDocuments({ guildId, active: true, fake: false });
    const totalLeft = await InviteEntry.countDocuments({ guildId, active: false });
    const totalFake = await InviteEntry.countDocuments({ guildId, fake: true });

    // Recent joins (last 10)
    const recentJoins = await InviteEntry.find({ guildId })
      .sort({ joinedAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({
      leaderboard: leaderboard.map((entry, i) => ({
        rank: skip + i + 1,
        inviterId: entry._id,
        total: entry.total,
        active: entry.active,
        left: entry.left,
        fake: entry.fake,
      })),
      pagination: {
        page,
        limit,
        totalInviters: totalInviters.length,
        totalPages: Math.ceil(totalInviters.length / limit),
      },
      overview: {
        totalEntries,
        totalActive,
        totalLeft,
        totalFake,
      },
      recentJoins: recentJoins.map((e: any) => ({
        joinedUserId: e.joinedUserId,
        inviterId: e.inviterId,
        inviteCode: e.inviteCode,
        active: e.active,
        fake: e.fake,
        joinedAt: e.joinedAt,
        leftAt: e.leftAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching invite tracker stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
