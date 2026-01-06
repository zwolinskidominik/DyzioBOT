import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";
import ChannelStatsModel from "@/models/ChannelStats";

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

    await connectDB();

    const config = await ChannelStatsModel.findOne({ guildId });
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    let hasChanges = false;

    for (const categoryKey of ['lastJoined', 'users', 'bots', 'bans'] as const) {
      const categoryData = config.channels[categoryKey];
      
      if (categoryData?.channelId) {
        const response = await fetch(
          `https://discord.com/api/v10/channels/${categoryData.channelId}`,
          {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );

        if (!response.ok) {
          console.log(`Channel ${categoryData.channelId} (${categoryKey}) doesn't exist, removing from config`);
          config.channels[categoryKey]!.channelId = undefined;
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      await config.save();
      console.log(`Cleaned up invalid channels for guild ${guildId}`);
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error validating channels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
