import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import { z } from 'zod';

// Whitelist pól POST-a — blokuje mass assignment.
const commandConfigZod = z.object({
  enabled: z.boolean().optional(),
  disabledCommands: z.array(z.string()).optional(),
});

const commandConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    disabledCommands: { type: [String], default: [] },
  },
  {
    collection: 'commandconfigs',
    timestamps: true,
  }
);

if (mongoose.models.CommandConfig) {
  delete mongoose.models.CommandConfig;
}

const CommandConfig = mongoose.model('CommandConfig', commandConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const DEFAULT_CONFIG = {
  enabled: true,
  disabledCommands: [] as string[],
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const config = await CommandConfig.findOne({ guildId });

    return NextResponse.json(
      config ? config.toObject() : { guildId, ...DEFAULT_CONFIG }
    );
  } catch (error) {
    console.error('Error fetching commands config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const rawBody = await request.json();
    const parsed = commandConfigZod.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane konfiguracji', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();

    const result = await CommandConfig.findOneAndUpdate(
      { guildId },
      { guildId, ...parsed.data },
      { upsert: true, new: true }
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating commands config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
