import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";
import MonthlyStatsConfigModel, { IMonthlyStatsConfig } from "@/models/MonthlyStatsConfig";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

function serialize(config: {
  guildId: string;
  channelId?: string;
  enabled: boolean;
  topCount: number;
  msgRate?: number;
  voiceRate?: number;
}) {
  return {
    guildId: config.guildId,
    channelId: config.channelId,
    enabled: config.enabled,
    topCount: config.topCount,
    msgRate: config.msgRate ?? 1,
    voiceRate: config.voiceRate ?? 2,
  };
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

    const config = await MonthlyStatsConfigModel.findOne({ guildId }).lean<IMonthlyStatsConfig>();

    if (!config) {
      const newConfig = await MonthlyStatsConfigModel.create({
        guildId,
        enabled: false,
        topCount: 10,
        msgRate: 1,
        voiceRate: 2,
      });
      return NextResponse.json(serialize(newConfig));
    }

    return NextResponse.json(serialize(config));
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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const body = await req.json();

    const { channelId, enabled, topCount, msgRate, voiceRate } = body;

    if (topCount !== undefined && (topCount < 1 || topCount > 15)) {
      return NextResponse.json(
        { error: "topCount must be between 1 and 15" },
        { status: 400 }
      );
    }
    if (msgRate !== undefined && (msgRate < 1 || msgRate > 5)) {
      return NextResponse.json(
        { error: "msgRate must be between 1 and 5" },
        { status: 400 }
      );
    }
    if (voiceRate !== undefined && (voiceRate < 1 || voiceRate > 5)) {
      return NextResponse.json(
        { error: "voiceRate must be between 1 and 5" },
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
        msgRate: msgRate ?? 1,
        voiceRate: voiceRate ?? 2,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(serialize(config));
  } catch (error) {
    console.error("Error updating monthly stats config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
