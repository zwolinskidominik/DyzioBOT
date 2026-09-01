import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import { z } from 'zod';

// Whitelist pól POST-a — blokuje mass assignment. Kształt musi odzwierciedlać
// bot/src/models/ModerationConfig.ts (osobny projekt npm — bez cross-project importu,
// zgodnie z konwencją reszty dashboardu, np. anti-spam/config, qotd/config).
const commandConfigZod = z
  .object({
    on: z.boolean(),
    extraRoleIds: z.array(z.string()),
    dm: z.boolean(),
    log: z.boolean(),
  })
  .partial();

const warnStepZod = z.object({
  action: z.enum(['none', 'mute', 'kick', 'ban']),
  durationMinutes: z.number().int().min(0).max(60 * 24 * 28), // max 28 dni — limit Discord timeoutu
});

const moderationConfigZod = z
  .object({
    enabled: z.boolean(),
    warn: commandConfigZod,
    warnRemove: commandConfigZod,
    mute: commandConfigZod,
    kick: commandConfigZod,
    ban: commandConfigZod,
    unban: commandConfigZod,
    clear: commandConfigZod,
    warnMode: z.enum(['single', 'ladder']),
    warnSingle: warnStepZod,
    warnSteps: z.array(warnStepZod).min(1).max(10),
    warnDm: z.boolean(),
    warnExpiryOn: z.boolean(),
    warnExpiryDays: z.number().int().min(1).max(3650),
  })
  .partial();

const commandConfigSchema = new mongoose.Schema(
  {
    on: { type: Boolean, default: true },
    extraRoleIds: { type: [String], default: [] },
    dm: { type: Boolean, default: true },
    log: { type: Boolean, default: true },
  },
  { _id: false }
);

const warnStepSchema = new mongoose.Schema(
  {
    action: { type: String, default: 'mute' },
    durationMinutes: { type: Number, default: 15 },
  },
  { _id: false }
);

const moderationConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    warn: { type: commandConfigSchema, default: () => ({}) },
    warnRemove: { type: commandConfigSchema, default: () => ({}) },
    mute: { type: commandConfigSchema, default: () => ({}) },
    kick: { type: commandConfigSchema, default: () => ({}) },
    ban: { type: commandConfigSchema, default: () => ({}) },
    unban: { type: commandConfigSchema, default: () => ({}) },
    clear: { type: commandConfigSchema, default: () => ({}) },
    warnMode: { type: String, default: 'ladder' },
    warnSingle: { type: warnStepSchema, default: () => ({ action: 'none', durationMinutes: 15 }) },
    warnSteps: {
      type: [warnStepSchema],
      default: () => [
        { action: 'mute', durationMinutes: 15 },
        { action: 'mute', durationMinutes: 180 },
        { action: 'mute', durationMinutes: 1440 },
        { action: 'ban', durationMinutes: 0 },
      ],
    },
    warnDm: { type: Boolean, default: true },
    warnExpiryOn: { type: Boolean, default: true },
    warnExpiryDays: { type: Number, default: 90 },
  },
  {
    collection: 'moderationconfigs',
    timestamps: true,
  }
);

if (mongoose.models.ModerationConfig) {
  delete mongoose.models.ModerationConfig;
}

const ModerationConfig = mongoose.model('ModerationConfig', moderationConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const DEFAULT_COMMAND = { on: true, extraRoleIds: [] as string[], dm: true, log: true };

const DEFAULT_CONFIG = {
  enabled: true,
  warn: { ...DEFAULT_COMMAND },
  warnRemove: { ...DEFAULT_COMMAND },
  mute: { ...DEFAULT_COMMAND },
  kick: { ...DEFAULT_COMMAND },
  ban: { ...DEFAULT_COMMAND },
  unban: { ...DEFAULT_COMMAND },
  clear: { ...DEFAULT_COMMAND },
  warnMode: 'ladder' as const,
  warnSingle: { action: 'none' as const, durationMinutes: 15 },
  warnSteps: [
    { action: 'mute' as const, durationMinutes: 15 },
    { action: 'mute' as const, durationMinutes: 180 },
    { action: 'mute' as const, durationMinutes: 1440 },
    { action: 'ban' as const, durationMinutes: 0 },
  ],
  warnDm: true,
  warnExpiryOn: true,
  warnExpiryDays: 90,
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

    const config = await ModerationConfig.findOne({ guildId });

    return NextResponse.json(config ? config.toObject() : { guildId, ...DEFAULT_CONFIG });
  } catch (error) {
    console.error('Error fetching moderation config:', error);
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
    const parsed = moderationConfigZod.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane konfiguracji', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();

    const result = await ModerationConfig.findOneAndUpdate(
      { guildId },
      { guildId, ...parsed.data },
      { upsert: true, new: true }
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating moderation config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
