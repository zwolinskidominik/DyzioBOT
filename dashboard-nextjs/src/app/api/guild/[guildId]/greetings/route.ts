import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";

const greetingsConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  greetingsChannelId: { type: String, required: true },
  rulesChannelId: { type: String },
  rolesChannelId: { type: String },
  chatChannelId: { type: String },
  welcomeEnabled: { type: Boolean, default: true },
  goodbyeEnabled: { type: Boolean, default: true },
  dmEnabled: { type: Boolean, default: false },
  welcomeMessage: { type: String },
  goodbyeMessage: { type: String },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'greetingsconfigurations'
});

if (mongoose.models.GreetingsConfig) {
  delete mongoose.models.GreetingsConfig;
}

const GreetingsConfig = mongoose.model("GreetingsConfig", greetingsConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    await connectDB();

    const config = await GreetingsConfig.findOne({ guildId: String(guildId) });
    
    if (!config) {
      return NextResponse.json(null);
    }
    
    return NextResponse.json(config.toObject());
  } catch (error) {
    console.error("Error fetching greetings config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const body = await request.json();

    await connectDB();

    const config = await GreetingsConfig.findOneAndUpdate(
      { guildId: String(guildId) },
      {
        ...body,
        guildId: String(guildId),
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(config.toObject());
  } catch (error) {
    console.error("Error saving greetings config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
