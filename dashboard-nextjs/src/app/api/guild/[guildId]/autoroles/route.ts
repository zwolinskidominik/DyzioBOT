import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";
import { z } from "zod";

// Whitelist pól POST-a — blokuje mass assignment.
const autoRoleZod = z.object({
  userRoleIds: z.array(z.string()).optional(),
  botRoleIds: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

const autoRoleSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  userRoleIds: { type: [String], default: [] },
  botRoleIds: { type: [String], default: [] },
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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const rawBody = await request.json();
    const parsed = autoRoleZod.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Nieprawidłowe dane konfiguracji", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();

    const config = await AutoRole.findOneAndUpdate(
      { guildId: String(guildId) },
      {
        ...parsed.data,
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
