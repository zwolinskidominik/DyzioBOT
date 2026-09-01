import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import { z } from 'zod';

// Whitelist pól POST-a — blokuje mass assignment (dowolne dodatkowe pola albo
// wartości spoza sensownego zakresu wchodzące prosto do zapisu w bazie).
const ruleZod = z
  .object({
    on: z.boolean(),
    deleteMessage: z.boolean(),
    mode: z.string(),
    action: z.string(),
    steps: z.array(z.string()),
    muteDuration: z.string(),
    reset: z.string(),
    threshold: z.number().int().min(1).max(1000),
    windowSeconds: z.number().int().min(1).max(3600),
    allowOwnServerInvites: z.boolean(),
  })
  .partial();

const antiSpamConfigZod = z.object({
  enabled: z.boolean().optional(),
  ignoredChannels: z.array(z.string()).optional(),
  ignoredRoles: z.array(z.string()).optional(),
  rate: ruleZod.optional(),
  invites: ruleZod.optional(),
  mentions: ruleZod.optional(),
  repeat: ruleZod.optional(),
});

const ruleSchema = new mongoose.Schema(
  {
    on: { type: Boolean, default: false },
    deleteMessage: { type: Boolean, default: true },
    mode: { type: String, default: 'single' },
    action: { type: String, default: 'mute' },
    steps: { type: [String], default: ['warn'] },
    muteDuration: { type: String, default: '5' },
    reset: { type: String, default: '24' },
    threshold: { type: Number, default: 5 },
    windowSeconds: { type: Number, default: 3 },
    allowOwnServerInvites: { type: Boolean, default: true },
  },
  { _id: false }
);

const antiSpamConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    ignoredChannels: { type: [String], default: [] },
    ignoredRoles: { type: [String], default: [] },
    rate: { type: ruleSchema, default: () => ({ on: true, threshold: 5, windowSeconds: 3 }) },
    invites: { type: ruleSchema, default: () => ({ on: false, threshold: 5, windowSeconds: 3 }) },
    mentions: { type: ruleSchema, default: () => ({ on: false, threshold: 5, windowSeconds: 3 }) },
    repeat: { type: ruleSchema, default: () => ({ on: false, threshold: 3, windowSeconds: 30 }) },
  },
  {
    collection: 'antispamconfigs',
    timestamps: true,
  }
);

if (mongoose.models.AntiSpamConfig) {
  delete mongoose.models.AntiSpamConfig;
}

const AntiSpamConfig = mongoose.model('AntiSpamConfig', antiSpamConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const BASE_RULE = {
  deleteMessage: true,
  mode: 'single',
  action: 'mute',
  steps: ['warn'],
  muteDuration: '5',
  reset: '24',
  allowOwnServerInvites: true,
};

const DEFAULT_CONFIG = {
  enabled: false,
  ignoredChannels: [],
  ignoredRoles: [],
  rate: { ...BASE_RULE, on: true, threshold: 5, windowSeconds: 3 },
  invites: { ...BASE_RULE, on: false, threshold: 5, windowSeconds: 3 },
  mentions: { ...BASE_RULE, on: false, threshold: 5, windowSeconds: 3 },
  repeat: { ...BASE_RULE, on: false, threshold: 3, windowSeconds: 30 },
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

    const config = await AntiSpamConfig.findOne({ guildId });

    return NextResponse.json(
      config ? config.toObject() : { guildId, ...DEFAULT_CONFIG }
    );
  } catch (error) {
    console.error('Error fetching anti-spam config:', error);
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
    const parsed = antiSpamConfigZod.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane konfiguracji', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();

    const result = await AntiSpamConfig.findOneAndUpdate(
      { guildId },
      { guildId, ...parsed.data },
      { upsert: true, new: true }
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating anti-spam config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
