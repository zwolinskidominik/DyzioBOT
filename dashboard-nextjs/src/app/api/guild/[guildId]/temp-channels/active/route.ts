import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

interface TempChannel {
  guildId: string;
  parentId: string;
  channelId: string;
  ownerId: string;
  controlMessageId?: string;
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

    const TempChannelModel = mongoose.models.TempChannel || 
      mongoose.model('TempChannel', new mongoose.Schema({
        guildId: String,
        parentId: String,
        channelId: String,
        ownerId: String,
        controlMessageId: String,
      }));

    const tempChannels = await TempChannelModel.find({ guildId }).lean();

    return NextResponse.json(tempChannels);
  } catch (error) {
    console.error("Error fetching temp channels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
