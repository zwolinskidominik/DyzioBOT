import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";
import ChannelStatsModel from "@/models/ChannelStats";
import { auditChange, createAuditLog } from "@/lib/auditLog";
import type { IAuditLogChange } from "@/models/AuditLog";
import { getDiscordAccessToken } from "@/lib/discordSessionToken";
import { z } from "zod";
import { parseJsonBody } from "@/lib/apiValidation";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

const counterCategory = z.enum(["lastJoined", "users", "bots", "bans"]);
const createCounterBody = z.object({
  category: counterCategory,
  // Szablon nazwy kanału (limit nazwy kanału Discorda: 100 znaków).
  template: z.string().min(1).max(100),
});
const deleteCounterBody = z.object({ category: counterCategory });

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !getDiscordAccessToken(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await context.params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const body = await parseJsonBody(req, createCounterBody);
    if (!body.ok) return body.response;
    const { category, template } = body.data;

    await connectDB();

    let config = await ChannelStatsModel.findOne({ guildId });
    if (!config) {
      config = new ChannelStatsModel({
        guildId,
        channels: {}
      });
    }


    const categoryData = config.channels[category as keyof typeof config.channels] || {};
    
    if (categoryData.channelId) {
      return NextResponse.json({ error: "Channel already exists" }, { status: 400 });
    }

    let initialName = template;
    
    initialName = initialName
      .replace(/<count>/g, '{count}')
      .replace(/<member>/g, '{member}')
      .replace(/<value>/g, '{value}');
    
    if (category === 'lastJoined') {
      initialName = initialName.replace(/{member}/g, 'Nikt');
    } else {
      initialName = initialName.replace(/{count}/g, '0');
    }

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: initialName.slice(0, 100),
          type: 2,
          position: 0,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Discord API error:", error);
      return NextResponse.json(
        { error: "Failed to create channel" },
        { status: response.status }
      );
    }

    const channelData = await response.json();

    if (!config.channels[category as keyof typeof config.channels]) {
      config.channels[category as keyof typeof config.channels] = {};
    }
    config.channels[category as keyof typeof config.channels]!.channelId = channelData.id;
    config.channels[category as keyof typeof config.channels]!.template = template;
    await config.save();

    const createChanges: IAuditLogChange[] = [
      auditChange('channelId', 'counterChannel', `#${channelData.name}`, undefined, { category }),
    ];

    await createAuditLog({
      guildId,
      userId: session.user?.id || session.user?.name || 'unknown',
      username: session.user?.name || session.user?.email || 'Unknown User',
      action: 'channel_stats.create_channel',
      module: 'channel_stats',
      descriptionKey: 'channelStatsCreated',
      descriptionParams: { category },
      metadata: {
        channelId: channelData.id,
        channelName: channelData.name,
        category,
        template,
      },
      changes: createChanges,
    });


    return NextResponse.json({
      channelId: channelData.id,
      channelName: channelData.name,
    });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !getDiscordAccessToken(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await context.params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const body = await parseJsonBody(req, deleteCounterBody);
    if (!body.ok) return body.response;
    const { category } = body.data;

    await connectDB();

    const config = await ChannelStatsModel.findOne({ guildId });
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const categoryData = config.channels[category as keyof typeof config.channels];
    const channelId = categoryData?.channelId;

    if (!channelId) {
      return NextResponse.json({ error: "Channel does not exist" }, { status: 400 });
    }

    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      console.error("Discord API error:", error);
      return NextResponse.json(
        { error: "Failed to delete channel" },
        { status: response.status }
      );
    }

    config.channels[category as keyof typeof config.channels]!.channelId = undefined;
    await config.save();

    const deleteChanges: IAuditLogChange[] = [
      auditChange('channelId', 'counterChannel', null, `#${channelId}`, { category }),
    ];

    await createAuditLog({
      guildId,
      userId: session.user?.id || session.user?.name || 'unknown',
      username: session.user?.name || session.user?.email || 'Unknown User',
      action: 'channel_stats.delete_channel',
      module: 'channel_stats',
      descriptionKey: 'channelStatsDeleted',
      descriptionParams: { category },
      metadata: { channelId, category },
      changes: deleteChanges,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
