import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import { auditChange, createAuditLog } from '@/lib/auditLog';
import { LOG_EVENT_NAMES_PL } from '@/i18n/messages/auditEntries';
import type { IAuditLogChange } from '@/models/AuditLog';
import { z } from 'zod';
import { getApiMessages } from '@/i18n/apiServer';

/** Klucze zdarzeń logu (nazwy są w słowniku wpisów logu panelu, zsynchronizowane z LOG_EVENT_CONFIGS). */
const EVENT_KEYS = Object.keys(LOG_EVENT_NAMES_PL);

// Whitelist pól POST-a — blokuje mass assignment. Klucze w mapach eventowych
// muszą być jednym z realnych zdarzeń logu (EVENT_KEYS), nie dowolnym stringiem.
const eventKeyedRecord = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.record(z.string(), valueSchema).refine(
    (obj) => Object.keys(obj).every((k) => EVENT_KEYS.includes(k)),
    { message: 'Unknown log event key' }
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
    changes.push(auditChange('enabled', 'logsModuleEnabled', next.enabled, oldEnabled));
  }

  for (const key of EVENT_KEYS) {
    const event = { event: key };

    const oldOn = Boolean(oldConfig?.enabledEvents?.[key]);
    const newOn = Boolean(next.enabledEvents[key]);
    if (oldConfig !== null && oldOn !== newOn) {
      changes.push(auditChange(`enabledEvents.${key}`, 'logEventLogging', newOn, oldOn, event));
    }

    const oldChannel = oldConfig?.logChannels?.[key];
    const newChannel = next.logChannels[key];
    if (oldConfig !== null && oldChannel !== newChannel) {
      changes.push(auditChange(`logChannels.${key}`, 'logEventChannel', newChannel ? `#${newChannel}` : null, oldChannel ? `#${oldChannel}` : null, event));
    }

    const oldColor = oldConfig?.colorOverrides?.[key];
    const newColor = next.colorOverrides[key];
    if (oldConfig !== null && oldColor !== newColor) {
      changes.push(auditChange(`colorOverrides.${key}`, 'logEventColor', newColor || { token: 'default' }, oldColor || { token: 'default' }, event));
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
        { error: (await getApiMessages()).t.errors.invalidConfig, details: parsedBody.error.flatten() },
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
        descriptionKey: 'logsUpdated',
        descriptionParams: { count: changes.length },
        changes,
      });
    }

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating log config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
