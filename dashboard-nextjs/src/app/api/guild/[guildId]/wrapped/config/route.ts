import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';
import { OWNER_IDS, OWNER_GUILD_IDS } from '@/lib/owner';
import WrappedConfigModel, { IWrappedConfig } from '@/models/WrappedConfig';
import { createAuditLog, diffFields } from '@/lib/auditLog';
import { DEFAULT_WRAPPED_THEME, resolveWrappedTheme } from '@/lib/wrappedThemes';

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
    const userId = (session.user as { id?: string })?.id ?? '';
    if (!OWNER_IDS.includes(userId) || !OWNER_GUILD_IDS.includes(guildId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let config = await WrappedConfigModel.findOne({ guildId }).lean<IWrappedConfig>();

    if (!config) {
      const newConfig = await WrappedConfigModel.create({
        guildId,
        enabled: false,
        colorTheme: DEFAULT_WRAPPED_THEME,
      });
      return NextResponse.json({
        guildId: newConfig.guildId,
        channelId: newConfig.channelId,
        enabled: newConfig.enabled,
        colorTheme: newConfig.colorTheme,
      });
    }

    return NextResponse.json({
      guildId: config.guildId,
      channelId: config.channelId,
      enabled: config.enabled,
      colorTheme: resolveWrappedTheme(config.colorTheme),
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
    const userId = (session.user as { id?: string })?.id ?? '';
    if (!OWNER_IDS.includes(userId) || !OWNER_GUILD_IDS.includes(guildId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    const { enabled, channelId, colorTheme } = body;

    const oldConfig = await WrappedConfigModel.findOne({ guildId }).lean<IWrappedConfig>();

    const config = await WrappedConfigModel.findOneAndUpdate(
      { guildId },
      {
        guildId,
        channelId: channelId || undefined,
        enabled: enabled !== undefined ? enabled : false,
        colorTheme: resolveWrappedTheme(colorTheme),
      },
      { upsert: true, new: true }
    );

    const changes = diffFields<Pick<IWrappedConfig, 'channelId' | 'enabled' | 'colorTheme'>>(
      oldConfig,
      { channelId: config.channelId, enabled: config.enabled, colorTheme: config.colorTheme },
      [
        { field: 'enabled', label: 'Włączony' },
        { field: 'channelId', label: 'Kanał' },
        { field: 'colorTheme', label: 'Motyw kolorystyczny' },
      ]
    );

    await createAuditLog({
      guildId,
      userId: session.user.id!,
      username: session.user.name || 'Unknown',
      action: 'update',
      module: 'wrapped',
      description: 'Zaktualizowano konfigurację Server Wrapped',
      metadata: { enabled, channelId, colorTheme: config.colorTheme },
      changes,
    });

    return NextResponse.json({
      guildId: config.guildId,
      channelId: config.channelId,
      enabled: config.enabled,
      colorTheme: config.colorTheme,
    });
  } catch (error) {
    console.error('Error updating wrapped config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
