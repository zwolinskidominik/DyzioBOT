import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';
import GiveawayConfig from '@/models/GiveawayConfig';
import { createAuditLog } from '@/lib/auditLog';

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

    await connectDB();
    const { guildId } = await params;

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

    await connectDB();
    const { guildId } = await params;
    const body = await req.json();

    const updatedConfig = await GiveawayConfig.findOneAndUpdate(
      { guildId },
      { 
        ...body,
        guildId 
      },
      { new: true, upsert: true }
    );

    await createAuditLog({
      guildId,
      userId: session.user.id!,
      username: session.user.name || 'Unknown',
      action: 'update',
      module: 'giveaway',
      description: 'Zaktualizowano konfigurację giveawayów',
      metadata: {
        enabled: body.enabled,
        roleMultipliersCount: body.roleMultipliers?.length || 0,
      },
    });

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error('Error updating giveaway config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
