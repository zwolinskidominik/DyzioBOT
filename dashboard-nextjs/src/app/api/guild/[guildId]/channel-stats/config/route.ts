import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";
import ChannelStatsModel from "@/models/ChannelStats";
import { createAuditLog, diffFields } from "@/lib/auditLog";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    let config = await ChannelStatsModel.findOne({ guildId });

    if (!config) {
      config = await ChannelStatsModel.create({
        guildId,
        enabled: true,
        channels: {
          lastJoined: {},
          users: {},
          bots: {},
          bans: {},
        },
      });
    }

    return NextResponse.json({
      guildId: config.guildId,
      enabled: config.enabled !== undefined ? config.enabled : true,
      channels: config.channels,
    });
  } catch (error) {
    console.error("Error fetching channel stats config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const body = await req.json();

    const { channels, enabled } = body;

    await connectDB();

    const oldConfig = await ChannelStatsModel.findOne({ guildId }).lean<{ enabled?: boolean; channels?: Record<string, { channelId?: string }> }>();

    const nextChannels = channels || {
      lastJoined: {},
      users: {},
      bots: {},
      bans: {},
    };
    const nextEnabled = typeof enabled === 'boolean' ? enabled : true;

    const config = await ChannelStatsModel.findOneAndUpdate(
      { guildId },
      {
        guildId,
        enabled: nextEnabled,
        channels: nextChannels,
      },
      { upsert: true, new: true }
    );

    const channelCategoryLabel = (v: any) => v?.channelId ? `#${v.channelId}` : 'brak';
    const changes = [
      ...diffFields({ enabled: oldConfig?.enabled }, { enabled: nextEnabled }, [
        { field: 'enabled', label: 'Włączony' },
      ]),
      ...diffFields(oldConfig?.channels, nextChannels, [
        { field: 'lastJoined', label: 'Kanał: ostatnio dołączył', formatValue: channelCategoryLabel },
        { field: 'users', label: 'Kanał: liczba użytkowników', formatValue: channelCategoryLabel },
        { field: 'bots', label: 'Kanał: liczba botów', formatValue: channelCategoryLabel },
        { field: 'bans', label: 'Kanał: liczba banów', formatValue: channelCategoryLabel },
      ]),
    ];

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || 'unknown',
      username: session.user.name || session.user.email || 'Unknown User',
      action: 'channel_stats.update',
      module: 'channel_stats',
      description: 'Zaktualizowano konfigurację kanałów ze statystykami',
      metadata: {
        channels: Object.keys(channels || {}),
        enabled: nextEnabled,
      },
      changes,
    });

    return NextResponse.json({
      guildId: config.guildId,
      enabled: config.enabled !== undefined ? config.enabled : true,
      channels: config.channels,
    });
  } catch (error) {
    console.error("Error updating channel stats config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
