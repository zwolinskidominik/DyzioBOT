import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";

const birthdayConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  birthdayChannelId: { type: String, required: true },
  roleId: { type: String },
  message: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'birthdayconfigurations'
});

// Delete cached model to ensure we use the correct collection name
if (mongoose.models.BirthdayConfig) {
  delete mongoose.models.BirthdayConfig;
}

const BirthdayConfig = mongoose.model("BirthdayConfig", birthdayConfigSchema);

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

    const config = await BirthdayConfig.findOne({ guildId: String(guildId) });
    
    if (!config) {
      // Try to find if there's a document with guildId as number
      const configAsNumber = await BirthdayConfig.findOne({ guildId: Number(guildId) });
      return NextResponse.json(configAsNumber ? configAsNumber.toObject() : null);
    }
    
    return NextResponse.json(config.toObject());
  } catch (error) {
    console.error("Error fetching birthday config:", error);
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
    const data = await request.json();

    await connectDB();

    const config = await BirthdayConfig.findOneAndUpdate(
      { guildId },
      {
        guildId,
        birthdayChannelId: data.birthdayChannelId,
        roleId: data.roleId,
        message: data.message,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error saving birthday config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
