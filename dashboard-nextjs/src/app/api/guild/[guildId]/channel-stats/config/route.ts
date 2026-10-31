import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";
import ChannelStatsModel from "@/models/ChannelStats";
import { createAuditLog, diffFields } from "@/lib/auditLog";
import { z } from "zod";
import { parseJsonBody, snowflake } from "@/lib/apiValidation";
import { requireChannelsInGuild } from "@/lib/guildChannels";

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

// Kanał licznika: ID kanału i szablon nazwy (limit nazwy kanału Discorda: 100 znaków).
const counterChannel = z.object({
  channelId: z.union([snowflake, z.literal("")]).optional(),
  template: z.string().max(100).optional(),
});
const channelStatsConfigBody = z.object({
  enabled: z.boolean().optional(),
  channels: z
    .object({
      lastJoined: counterChannel.optional(),
      users: counterChannel.optional(),
      bots: counterChannel.optional(),
      bans: counterChannel.optional(),
    })
    .optional(),
});

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

    const body = await parseJsonBody(req, channelStatsConfigBody);
    if (!body.ok) return body.response;
    const { channels, enabled } = body.data;

    // Kanały liczników bot później zmienia/usuwa - muszą należeć do tego serwera.
    const channelError = await requireChannelsInGuild(guildId, Object.values(channels ?? {}).map((entry) => entry?.channelId));
    if (channelError) return channelError;

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
      { upsert: true, returnDocument: 'after' }
    );

    const channelCategoryLabel = (v: unknown): string | null => {
      if (typeof v !== 'object' || v === null || !('channelId' in v)) return null;
      return typeof v.channelId === 'string' && v.channelId ? `#${v.channelId}` : null;
    };
    const changes = [
      ...diffFields({ enabled: oldConfig?.enabled }, { enabled: nextEnabled }, [
        { field: 'enabled', labelKey: 'enabled' },
      ]),
      ...diffFields(oldConfig?.channels, nextChannels, [
        { field: 'lastJoined', labelKey: 'counterLastJoined', formatValue: channelCategoryLabel },
        { field: 'users', labelKey: 'counterUsers', formatValue: channelCategoryLabel },
        { field: 'bots', labelKey: 'counterBots', formatValue: channelCategoryLabel },
        { field: 'bans', labelKey: 'counterBans', formatValue: channelCategoryLabel },
      ]),
    ];

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || 'unknown',
      username: session.user.name || session.user.email || 'Unknown User',
      action: 'channel_stats.update',
      module: 'channel_stats',
      descriptionKey: 'channelStatsUpdated',
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
