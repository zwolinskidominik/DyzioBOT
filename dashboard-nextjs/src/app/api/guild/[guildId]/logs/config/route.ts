import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import { createAuditLog } from '@/lib/auditLog';
import type { IAuditLogChange } from '@/models/AuditLog';
import { z } from 'zod';

/**
 * Polskie etykiety zdarzeń logów — MUSI być zsynchronizowane z `LOG_EVENT_CONFIGS` w
 * `app/(dashboard)/[guildId]/logs/page.tsx` (nazwy `.name`). Zduplikowane celowo: strona
 * to komponent kliencki, a ten route działa po stronie serwera.
 */
const EVENT_LABELS: Record<string, string> = {
  memberBan: 'Zbanowanie członka',
  memberUnban: 'Odbanowanie członka',
  memberKick: 'Wyrzucenie członka',
  memberTimeout: 'Wyciszenie',
  moderationCommand: 'Komenda moderacyjna',
  antiSpam: 'Anti-Spam',
  messageDelete: 'Usunięcie wiadomości',
  messageEdit: 'Edycja wiadomości',
  memberJoin: 'Członek dołączył',
  memberLeave: 'Członek opuścił',
  memberNicknameChange: 'Zmiana pseudonimu',
  memberRoleAdd: 'Nadanie roli',
  memberRoleRemove: 'Usunięcie roli',
  voiceJoin: 'Dołączył do VC',
  voiceLeave: 'Opuścił VC',
  voiceMove: 'Przełączył kanał VC',
  voiceDisconnect: 'Odłączony od VC',
  voiceMemberMove: 'Przeniesiony do VC',
  voiceStateChange: 'Stan głosu',
  channelCreate: 'Utworzenie kanału',
  channelDelete: 'Usunięcie kanału',
  channelUpdate: 'Aktualizacja kanału',
  channelPermissionUpdate: 'Aktualizacja uprawnień',
  threadCreate: 'Tworzenie wątku',
  threadDelete: 'Usuwanie wątku',
  threadUpdate: 'Aktualizacja wątku',
  roleCreate: 'Utworzenie roli',
  roleDelete: 'Usunięcie roli',
  roleUpdate: 'Aktualizacja roli',
  guildUpdate: 'Aktualizacja serwera',
  inviteCreate: 'Wysłano zaproszenie',
};

// Whitelist pól POST-a — blokuje mass assignment. Klucze w mapach eventowych
// muszą być jednym z realnych zdarzeń logu (EVENT_LABELS), nie dowolnym stringiem.
const EVENT_KEYS = Object.keys(EVENT_LABELS);
const eventKeyedRecord = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.record(z.string(), valueSchema).refine(
    (obj) => Object.keys(obj).every((k) => EVENT_KEYS.includes(k)),
    { message: 'Nieznany klucz zdarzenia logu' }
  );

const logConfigZod = z.object({
  enabled: z.boolean().optional(),
  logChannels: eventKeyedRecord(z.string()).optional(),
  enabledEvents: eventKeyedRecord(z.boolean()).optional(),
  ignoredChannels: z.array(z.string()).optional(),
  ignoredRoles: z.array(z.string()).optional(),
  ignoredUsers: z.array(z.string()).optional(),
  colorOverrides: eventKeyedRecord(z.string()).optional(),
});

/** Buduje changes[] porównując enabled + per-eventowe enabledEvents/logChannels/colorOverrides. */
function diffLogConfig(
  oldConfig: { enabled?: boolean; enabledEvents?: Record<string, boolean>; logChannels?: Record<string, string>; colorOverrides?: Record<string, string> } | null,
  next: { enabled: boolean; enabledEvents: Record<string, boolean>; logChannels: Record<string, string>; colorOverrides: Record<string, string> }
): IAuditLogChange[] {
  const changes: IAuditLogChange[] = [];

  const oldEnabled = Boolean(oldConfig?.enabled);
  if (oldConfig !== null && oldEnabled !== next.enabled) {
    changes.push({ field: 'enabled', label: 'Moduł logów włączony', from: oldEnabled ? 'włączony' : 'wyłączony', to: next.enabled ? 'włączony' : 'wyłączony' });
  }

  for (const key of Object.keys(EVENT_LABELS)) {
    const label = EVENT_LABELS[key];

    const oldOn = Boolean(oldConfig?.enabledEvents?.[key]);
    const newOn = Boolean(next.enabledEvents[key]);
    if (oldConfig !== null && oldOn !== newOn) {
      changes.push({ field: `enabledEvents.${key}`, label: `${label}: logowanie`, from: oldOn ? 'włączone' : 'wyłączone', to: newOn ? 'włączone' : 'wyłączone' });
    }

    const oldChannel = oldConfig?.logChannels?.[key];
    const newChannel = next.logChannels[key];
    if (oldConfig !== null && oldChannel !== newChannel) {
      changes.push({ field: `logChannels.${key}`, label: `${label}: kanał`, from: oldChannel ? `#${oldChannel}` : 'brak', to: newChannel ? `#${newChannel}` : 'brak' });
    }

    const oldColor = oldConfig?.colorOverrides?.[key];
    const newColor = next.colorOverrides[key];
    if (oldConfig !== null && oldColor !== newColor) {
      changes.push({ field: `colorOverrides.${key}`, label: `${label}: kolor`, from: oldColor || 'domyślny', to: newColor || 'domyślny' });
    }
  }

  return changes;
}

const logConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  logChannels: { type: Object, default: {} },
  enabledEvents: { type: Object, default: {} },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles: { type: [String], default: [] },
  ignoredUsers: { type: [String], default: [] },
  colorOverrides: { type: Object, default: {} },
}, {
  collection: 'logconfigurations',
  timestamps: true,
});

if (mongoose.models.LogConfiguration) {
  delete mongoose.models.LogConfiguration;
}

const LogConfiguration = mongoose.model('LogConfiguration', logConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

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

    const config = await LogConfiguration.findOne({ guildId });
    
    return NextResponse.json(config ? config.toObject() : {
      guildId,
      enabled: false,
      logChannels: {},
      enabledEvents: {},
      ignoredChannels: [],
      ignoredRoles: [],
      ignoredUsers: [],
      colorOverrides: {},
    });
  } catch (error) {
    console.error('Error fetching log config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
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

    const rawBody = await request.json();
    const parsedBody = logConfigZod.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane konfiguracji', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsedBody.data;

    await connectDB();

    const oldConfig = await LogConfiguration.findOne({ guildId }).lean<{
      enabled?: boolean;
      enabledEvents?: Record<string, boolean>;
      logChannels?: Record<string, string>;
      colorOverrides?: Record<string, string>;
    } | null>();

    const nextEnabled = body.enabled !== undefined ? Boolean(body.enabled) : true;
    const nextEnabledEvents: Record<string, boolean> = body.enabledEvents || {};
    const nextLogChannels: Record<string, string> = body.logChannels || {};
    const nextColorOverrides: Record<string, string> = body.colorOverrides || {};

    const result = await LogConfiguration.findOneAndUpdate(
      { guildId },
      {
        guildId,
        ...body,
      },
      { upsert: true, new: true }
    );

    const changes = diffLogConfig(oldConfig, {
      enabled: nextEnabled,
      enabledEvents: nextEnabledEvents,
      logChannels: nextLogChannels,
      colorOverrides: nextColorOverrides,
    });

    if (changes.length > 0) {
      await createAuditLog({
        guildId,
        userId: session.user.id || session.user.name || 'unknown',
        username: session.user.name || session.user.email || 'Unknown User',
        action: 'logs.update',
        module: 'logs',
        description: `Zaktualizowano konfigurację logów (${changes.length} ${changes.length === 1 ? 'zmiana' : 'zmian'})`,
        changes,
      });
    }

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating log config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
