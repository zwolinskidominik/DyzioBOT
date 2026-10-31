import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";
import TempChannelConfigurationModel, { ITempChannelCreator } from "@/models/TempChannelConfiguration";
import { createAuditLog, diffFields } from "@/lib/auditLog";
import { z } from "zod";
import { parseJsonBody, snowflake } from "@/lib/apiValidation";
import { requireChannelsInGuild } from "@/lib/guildChannels";

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

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    let config = await TempChannelConfigurationModel.findOne({ guildId });

    if (!config) {
      config = await TempChannelConfigurationModel.create({
        guildId,
        enabled: true,
        channelIds: [],
        creators: [],
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

const tempChannelsBody = z.object({
  enabled: z.boolean().optional(),
  creators: z.array(z.object({ channelId: snowflake, type: z.enum(["panel", "standard"]) })).max(50).optional(),
  channelIds: z.array(snowflake).max(50).optional(),
});

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

    await connectDB();
    const parsed = await parseJsonBody(req, tempChannelsBody);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    // Zapis idzie surowym insertOne (bez schematu Mongoose), więc budujemy dokument wyłącznie
    // ze zwalidowanych pól - nigdy z obiektów przysłanych przez klienta.
    const creators: ITempChannelCreator[] = body.creators
      ? body.creators.map((creator) => ({ channelId: creator.channelId, type: creator.type }))
      : (body.channelIds ?? []).map((channelId) => ({ channelId, type: "panel" as const }));

    const channelError = await requireChannelsInGuild(guildId, creators.map((creator) => creator.channelId));
    if (channelError) return channelError;
    const channelIds = creators.map((c) => c.channelId);

    const existing = await TempChannelConfigurationModel.findOne({ guildId });
    const enabled = typeof body.enabled === "boolean" ? body.enabled : (existing?.enabled ?? true);

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    await db.collection('tempchannelconfigurations').deleteOne({ guildId });
    await db.collection('tempchannelconfigurations').insertOne({
      guildId,
      enabled,
      channelIds,
      creators,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    });

    const config = await TempChannelConfigurationModel.findOne({ guildId });

    const changes = diffFields(
      existing ? { enabled: existing.enabled, channelIds: existing.channelIds, creators: existing.creators } : null,
      { enabled, channelIds, creators },
      [
        { field: 'enabled', labelKey: 'enabled' },
        { field: 'channelIds', labelKey: 'channelCount' },
        { field: 'creators', labelKey: 'creatorCount' },
      ]
    );

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || 'unknown',
      username: session.user.name || session.user.email || 'Unknown User',
      action: 'temp_channels.update',
      module: 'temp_channels',
      descriptionKey: 'tempChannelsUpdated',
      descriptionParams: { count: channelIds.length },
      metadata: {
        channelIds,
        creators,
        count: channelIds.length,
      },
      changes,
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
