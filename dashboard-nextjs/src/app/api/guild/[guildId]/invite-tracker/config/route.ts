import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';
import InviteTrackerConfig from '@/models/InviteTrackerConfig';
import { createAuditLog, diffFields } from '@/lib/auditLog';
import { requireGuildAccess } from '@/lib/requireGuildAccess';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

const EMPTY_JOIN_MESSAGES = { normal: '', selfInvite: '', unknown: '', vanity: '', botAdd: '' };
const EMPTY_LEAVE_MESSAGES = { normal: '', unknown: '', vanity: '', botRemove: '' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(guildId: string, config: any) {
  // `legacy` czyta pola sprzed redesignu (płaski kształt) — dokument może je jeszcze
  // mieć, jeśli migracja bota (src/scripts/migrateInviteTrackerConfig.ts) nie została uruchomiona.
  const legacy = config ?? {};

  return {
    guildId,
    enabled: config?.enabled ?? false,
    join: {
      enabled: config?.join?.enabled ?? true,
      logChannelId: config?.join?.logChannelId ?? legacy.logChannelId ?? null,
      embed: config?.join?.embed ?? false,
      embedColor: config?.join?.embedColor ?? '',
      messages: {
        ...EMPTY_JOIN_MESSAGES,
        normal: config?.join?.messages?.normal || legacy.joinMessage || '',
        selfInvite: config?.join?.messages?.selfInvite || '',
        unknown: config?.join?.messages?.unknown || legacy.joinMessageUnknown || '',
        vanity: config?.join?.messages?.vanity || legacy.joinMessageVanity || '',
        botAdd: config?.join?.messages?.botAdd || '',
      },
    },
    leave: {
      enabled: config?.leave?.enabled ?? true,
      logChannelId: config?.leave?.logChannelId ?? legacy.logChannelId ?? null,
      embed: config?.leave?.embed ?? false,
      embedColor: config?.leave?.embedColor ?? '',
      messages: {
        ...EMPTY_LEAVE_MESSAGES,
        normal: config?.leave?.messages?.normal || legacy.leaveMessage || '',
        unknown: config?.leave?.messages?.unknown || '',
        vanity: config?.leave?.messages?.vanity || '',
        botRemove: config?.leave?.messages?.botRemove || '',
      },
    },
  };
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

    const config = await InviteTrackerConfig.findOne({ guildId }).lean();

    return NextResponse.json(serialize(guildId, config));
  } catch (error) {
    console.error('Error fetching invite tracker config:', error);
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
    const body = await req.json();

    const { enabled, join, leave } = body;

    const oldConfig = await InviteTrackerConfig.findOne({ guildId }).lean();
    const oldSerialized = serialize(guildId, oldConfig);

    const updatedConfig = await InviteTrackerConfig.findOneAndUpdate(
      { guildId },
      {
        guildId,
        enabled: enabled ?? false,
        join: {
          enabled: join?.enabled ?? true,
          logChannelId: join?.logChannelId || null,
          embed: join?.embed ?? false,
          embedColor: join?.embedColor || '',
          messages: { ...EMPTY_JOIN_MESSAGES, ...(join?.messages ?? {}) },
        },
        leave: {
          enabled: leave?.enabled ?? true,
          logChannelId: leave?.logChannelId || null,
          embed: leave?.embed ?? false,
          embedColor: leave?.embedColor || '',
          messages: { ...EMPTY_LEAVE_MESSAGES, ...(leave?.messages ?? {}) },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, overwrite: true },
    ).lean();

    const newSerialized = serialize(guildId, updatedConfig);
    const flatten = (s: ReturnType<typeof serialize>) => ({
      enabled: s.enabled,
      joinEnabled: s.join.enabled,
      joinLogChannelId: s.join.logChannelId,
      joinEmbed: s.join.embed,
      leaveEnabled: s.leave.enabled,
      leaveLogChannelId: s.leave.logChannelId,
      leaveEmbed: s.leave.embed,
    });
    const changes = diffFields(flatten(oldSerialized), flatten(newSerialized), [
      { field: 'enabled', label: 'Włączony' },
      { field: 'joinEnabled', label: 'Powiadomienia o dołączeniu' },
      { field: 'joinLogChannelId', label: 'Kanał logów dołączeń' },
      { field: 'joinEmbed', label: 'Embed przy dołączeniu' },
      { field: 'leaveEnabled', label: 'Powiadomienia o opuszczeniu' },
      { field: 'leaveLogChannelId', label: 'Kanał logów opuszczeń' },
      { field: 'leaveEmbed', label: 'Embed przy opuszczeniu' },
    ]);

    await createAuditLog({
      guildId,
      userId: (session.user as { id?: string }).id ?? '',
      username: session.user?.name ?? '',
      action: 'UPDATE',
      module: 'invite-tracker',
      description: `Zaktualizowano konfigurację Invite Trackera (enabled: ${enabled ?? false})`,
      changes,
    });

    return NextResponse.json(serialize(guildId, updatedConfig));
  } catch (error) {
    console.error('Error saving invite tracker config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
