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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { guildId } = await params;

    let config = await ChannelStatsModel.findOne({ guildId });

    if (!config) {
      config = await ChannelStatsModel.create({
        guildId,
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
    const body = await req.json();

    const { channels } = body;

    await connectDB();

    const config = await ChannelStatsModel.findOneAndUpdate(
      { guildId },
      {
        guildId,
        channels: channels || {
          lastJoined: {},
          users: {},
          bots: {},
          bans: {},
        },
      },
      { upsert: true, new: true }
    );

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || 'unknown',
      username: session.user.name || session.user.email || 'Unknown User',
      action: 'channel_stats.update',
      module: 'channel_stats',
      description: 'Zaktualizowano konfigurację kanałów ze statystykami',
      metadata: {
        channels: Object.keys(channels || {}),
      },
    });

    return NextResponse.json({
      guildId: config.guildId,
      channels: config.channels,
    });
  } catch (error) {
    console.error("Error updating channel stats config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
