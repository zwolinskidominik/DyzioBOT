import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";

const autoRoleSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  roleIds: { type: [String], default: [] },
  enabled: { type: Boolean, default: false },
}, {
  collection: 'autoroles'
});

if (mongoose.models.AutoRole) {
  delete mongoose.models.AutoRole;
}

const AutoRole = mongoose.model("AutoRole", autoRoleSchema);

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

    const config = await AutoRole.findOne({ guildId: String(guildId) });
    
    if (!config) {
      return NextResponse.json({ roleIds: [] });
    }
    
    return NextResponse.json(config.toObject());
  } catch (error) {
    console.error("Error fetching autorole config:", error);
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

    const config = await AutoRole.findOneAndUpdate(
      { guildId: String(guildId) },
      {
        ...body,
        guildId: String(guildId),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(config.toObject());
  } catch (error) {
    console.error("Error saving autorole config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
