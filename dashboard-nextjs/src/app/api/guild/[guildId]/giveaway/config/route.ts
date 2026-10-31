import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import GiveawayConfig from '@/models/GiveawayConfig';
import { createAuditLog, diffFields } from '@/lib/auditLog';
import { z } from 'zod';
import { getApiMessages } from '@/i18n/apiServer';

// Whitelist pól POST-a — blokuje mass assignment.
const giveawayConfigZod = z.object({
  enabled: z.boolean().optional(),
  additionalNote: z.string().max(500).optional(),
  roleMultipliers: z
    .array(
      z.object({
        roleId: z.string(),
        multiplier: z.number().min(0).max(100),
      })
    )
    .optional(),
});

interface RoleMultiplier {
  roleId: string;
  multiplier: number;
}

interface IGiveawayConfig {
  guildId: string;
  enabled: boolean;
  additionalNote?: string;
  roleMultipliers: RoleMultiplier[];
}

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const config = await GiveawayConfig.findOne({ guildId }).lean<IGiveawayConfig>();

    return NextResponse.json({
      guildId,
      enabled: config?.enabled ?? false,
      additionalNote: config?.additionalNote || '',
      roleMultipliers: config?.roleMultipliers || [],
    });
  } catch (error) {
    console.error('Error fetching giveaway config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();
    const rawBody = await req.json();
    const parsed = giveawayConfigZod.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (await getApiMessages()).t.errors.invalidConfig, details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const oldConfig = await GiveawayConfig.findOne({ guildId }).lean<IGiveawayConfig>();

    const updatedConfig = await GiveawayConfig.findOneAndUpdate(
      { guildId },
      {
        ...body,
        guildId
      },
      { returnDocument: 'after', upsert: true }
    );

    const changes = diffFields(oldConfig, { ...body, guildId }, [
      { field: 'enabled', labelKey: 'enabled' },
      { field: 'additionalNote', labelKey: 'additionalNote' },
      { field: 'roleMultipliers', labelKey: 'roleMultiplierCount' },
    ]);

    await createAuditLog({
      guildId,
      userId: session.user.id!,
      username: session.user.name || 'Unknown',
      action: 'update',
      module: 'giveaway',
      descriptionKey: 'giveawayUpdated',
      metadata: {
        enabled: body.enabled,
        roleMultipliersCount: body.roleMultipliers?.length || 0,
      },
      changes,
    });

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error('Error updating giveaway config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
