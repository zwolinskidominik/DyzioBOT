import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';
import InviteTrackerConfig from '@/models/InviteTrackerConfig';
import { createAuditLog } from '@/lib/auditLog';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

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

    const config = await InviteTrackerConfig.findOne({ guildId }).lean();

    return NextResponse.json({
      guildId,
      enabled: (config as any)?.enabled ?? false,
      logChannelId: (config as any)?.logChannelId || null,
      joinMessage: (config as any)?.joinMessage || '',
      leaveMessage: (config as any)?.leaveMessage || '',
    });
  } catch (error) {
    console.error('Error fetching invite tracker config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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
    const body = await req.json();

    const { enabled, logChannelId, joinMessage, leaveMessage } = body;

    const updatedConfig = await InviteTrackerConfig.findOneAndUpdate(
      { guildId },
      {
        guildId,
        enabled: enabled ?? false,
        logChannelId: logChannelId || null,
        joinMessage: joinMessage || '',
        leaveMessage: leaveMessage || '',
      },
      { upsert: true, new: true },
    ).lean();

    await createAuditLog({
      guildId,
      userId: (session.user as any).id ?? '',
      username: session.user?.name ?? '',
      action: 'UPDATE',
      module: 'invite-tracker',
      description: `Zaktualizowano konfigurację Invite Trackera (enabled: ${enabled ?? false})`,
    });

    return NextResponse.json({
      guildId,
      enabled: (updatedConfig as any)?.enabled ?? false,
      logChannelId: (updatedConfig as any)?.logChannelId || null,
      joinMessage: (updatedConfig as any)?.joinMessage || '',
      leaveMessage: (updatedConfig as any)?.leaveMessage || '',
    });
  } catch (error) {
    console.error('Error saving invite tracker config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
