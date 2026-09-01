import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";

const reactionRoleConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
}, {
  collection: 'reactionroleconfigs'
});

if (mongoose.models.ReactionRoleConfig) {
  delete mongoose.models.ReactionRoleConfig;
}

const ReactionRoleConfig = mongoose.model("ReactionRoleConfig", reactionRoleConfigSchema);

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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const config = await ReactionRoleConfig.findOne({ guildId: String(guildId) });

    if (!config) {
      return NextResponse.json({ guildId, enabled: true });
    }

    return NextResponse.json(config.toObject());
  } catch (error) {
    console.error("Error fetching reaction-role config:", error);
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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const body = await request.json();

    await connectDB();

    const config = await ReactionRoleConfig.findOneAndUpdate(
      { guildId: String(guildId) },
      {
        enabled: body.enabled !== false,
        guildId: String(guildId),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(config.toObject());
  } catch (error) {
    console.error("Error saving reaction-role config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
