import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";
import MonthlyStatsConfigModel, { IMonthlyStatsConfig } from "@/models/MonthlyStatsConfig";

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

    let config = await MonthlyStatsConfigModel.findOne({ guildId }).lean<IMonthlyStatsConfig>();

    if (!config) {
      const newConfig = await MonthlyStatsConfigModel.create({
        guildId,
        enabled: false,
        topCount: 10,
      });
      return NextResponse.json({
        guildId: newConfig.guildId,
        channelId: newConfig.channelId,
        enabled: newConfig.enabled,
        topCount: newConfig.topCount,
      });
    }

    return NextResponse.json({
      guildId: config.guildId,
      channelId: config.channelId,
      enabled: config.enabled,
      topCount: config.topCount,
    });
  } catch (error) {
    console.error("Error fetching monthly stats config:", error);
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

    const { channelId, enabled, topCount } = body;

    if (topCount !== undefined && (topCount < 1 || topCount > 25)) {
      return NextResponse.json(
        { error: "topCount must be between 1 and 25" },
        { status: 400 }
      );
    }

    await connectDB();

    const config = await MonthlyStatsConfigModel.findOneAndUpdate(
      { guildId },
      {
        guildId,
        channelId: channelId || undefined,
        enabled: enabled !== undefined ? enabled : false,
        topCount: topCount ?? 10,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      guildId: config.guildId,
      channelId: config.channelId,
      enabled: config.enabled,
      topCount: config.topCount,
    });
  } catch (error) {
    console.error("Error updating monthly stats config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
