import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";
import ChannelStatsModel from "@/models/ChannelStats";
import { createAuditLog } from "@/lib/auditLog";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await context.params;
    const { category, template } = await req.json();

    console.log('[Create Channel] Request:', { guildId, category, template });

    if (!category || !['lastJoined', 'users', 'bots', 'bans'].includes(category)) {
      console.log('[Create Channel] Invalid category:', category);
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    
    if (!template) {
      console.log('[Create Channel] Template is required');
      return NextResponse.json({ error: "Template is required" }, { status: 400 });
    }

    await connectDB();

    let config = await ChannelStatsModel.findOne({ guildId });
    if (!config) {
      console.log('[Create Channel] Creating new config for guild:', guildId);
      config = new ChannelStatsModel({
        guildId,
        channels: {}
      });
    }

    console.log('[Create Channel] Config channels:', config.channels);

    const categoryData = config.channels[category as keyof typeof config.channels] || {};
    console.log('[Create Channel] Category data:', categoryData);
    
    if (categoryData.channelId) {
      console.log('[Create Channel] Channel already exists:', categoryData.channelId);
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

    await createAuditLog({
      guildId,
      userId: session.user?.id || session.user?.name || 'unknown',
      username: session.user?.name || session.user?.email || 'Unknown User',
      action: 'channel_stats.create_channel',
      module: 'channel_stats',
      description: `Utworzono kanał statystyk: ${category}`,
      metadata: {
        channelId: channelData.id,
        channelName: channelData.name,
        category,
        template,
      },
    });

    console.log('[Create Channel] Success:', { channelId: channelData.id, channelName: channelData.name });

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
