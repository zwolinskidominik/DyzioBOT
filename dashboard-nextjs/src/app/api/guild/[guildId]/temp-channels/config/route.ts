import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";
import TempChannelConfigurationModel from "@/models/TempChannelConfiguration";
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

    let config = await TempChannelConfigurationModel.findOne({ guildId });

    if (!config) {
      config = await TempChannelConfigurationModel.create({
        guildId,
        channelIds: [],
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching temp channel config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    await connectDB();
    const { guildId } = await params;
    const { channelIds } = await req.json();

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    await db.collection('tempchannelconfigurations').deleteOne({ guildId });
    await db.collection('tempchannelconfigurations').insertOne({
      guildId,
      channelIds,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    });

    const config = await TempChannelConfigurationModel.findOne({ guildId });

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || 'unknown',
      username: session.user.name || session.user.email || 'Unknown User',
      action: 'temp_channels.update',
      module: 'temp_channels',
      description: `Zaktualizowano kanały tymczasowe (${channelIds.length} kanałów)`,
      metadata: {
        channelIds,
        count: channelIds.length,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating temp channel config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    await db.collection('tempchannelconfigurations').deleteOne({ guildId });

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || 'unknown',
      username: session.user.name || session.user.email || 'Unknown User',
      action: 'temp_channels.delete',
      module: 'temp_channels',
      description: 'Usunięto konfigurację kanałów tymczasowych',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting temp channel config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
