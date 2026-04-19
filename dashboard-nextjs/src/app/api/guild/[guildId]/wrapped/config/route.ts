import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';
import WrappedConfigModel, { IWrappedConfig } from '@/models/WrappedConfig';
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

    let config = await WrappedConfigModel.findOne({ guildId }).lean<IWrappedConfig>();

    if (!config) {
      const newConfig = await WrappedConfigModel.create({
        guildId,
        enabled: false,
      });
      return NextResponse.json({
        guildId: newConfig.guildId,
        channelId: newConfig.channelId,
        enabled: newConfig.enabled,
      });
    }

    return NextResponse.json({
      guildId: config.guildId,
      channelId: config.channelId,
      enabled: config.enabled,
    });
  } catch (error) {
    console.error('Error fetching wrapped config:', error);
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

    const { enabled, channelId } = body;

    const config = await WrappedConfigModel.findOneAndUpdate(
      { guildId },
      {
        guildId,
        channelId: channelId || undefined,
        enabled: enabled !== undefined ? enabled : false,
      },
      { upsert: true, new: true }
    );

    await createAuditLog({
      guildId,
      userId: session.user.id!,
      username: session.user.name || 'Unknown',
      action: 'update',
      module: 'wrapped',
      description: 'Zaktualizowano konfigurację Server Wrapped',
      metadata: { enabled, channelId },
    });

    return NextResponse.json({
      guildId: config.guildId,
      channelId: config.channelId,
      enabled: config.enabled,
    });
  } catch (error) {
    console.error('Error updating wrapped config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
