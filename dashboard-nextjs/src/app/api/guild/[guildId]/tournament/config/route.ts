import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';
import { OWNER_IDS, OWNER_GUILD_IDS } from '@/lib/owner';
import TournamentConfig from '@/models/TournamentConfig';
import { createAuditLog, diffFields } from '@/lib/auditLog';

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
    const userId = (session.user as { id?: string })?.id ?? '';
    if (!OWNER_IDS.includes(userId) || !OWNER_GUILD_IDS.includes(guildId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await TournamentConfig.findOne({ guildId }).lean();

    const defaultTemplate = `# Zasady co poniedziałkowych mixów 5vs5 {roleMention}
**Do kogo można się zgłaszać z dodatkowymi pytaniami o turniej?** 
 {organizerRoleMention}: {organizerUserPings}
### Zbiórka i start
-# Zbieramy się na kanale głosowym {voiceChannelLink} o godzinie **20:30 w każdy poniedziałek**. Do turnieju może dołączyć **każdy** zainteresowany rywalizacją i dobrą zabawą. Następnie przechodzimy do **losowania drużyn** na kole fortuny.
### Zakaz używania cheatów
-# Używanie programów wspomagających jest surowo zabronione. Turniej opiera się na uczciwej rywalizacji i dobrej atmosferze!
### Eksperymentowanie z bronią
-# Zeusy, kosy, granaty oraz wszelkie nietypowe bronie są mile widziane! Staraj się nie tryhardować - to nie jest mecz o rangę!
### Kultura
-# Szanujmy zarówno przeciwników, jak i swoich teammate'ów. Obrażanie, negatywne komentarze lub wyzwiska są zabronione – celem jest pozytywna atmosfera i dobra zabawa.`;

    return NextResponse.json({
      guildId,
      enabled: (config as any)?.enabled ?? false,
      channelId: (config as any)?.channelId || null,
      messageTemplate: (config as any)?.messageTemplate || defaultTemplate,
      cronSchedule: (config as any)?.cronSchedule || '25 20 * * 1',
      reactionEmoji: (config as any)?.reactionEmoji || '🎮',
      messageMode: (config as any)?.messageMode || 'text',
      embedColor: (config as any)?.embedColor || '#3b82f6',
      titleText: (config as any)?.titleText ?? '🏆 Turniej CS2',
      footerText: (config as any)?.footerText ?? '',
      participantRoleId: (config as any)?.participantRoleId || null,
      organizerRoleId: (config as any)?.organizerRoleId || null,
      organizerUserIds: (config as any)?.organizerUserIds || [],
      voiceChannelId: (config as any)?.voiceChannelId || null,
    });
  } catch (error) {
    console.error('Error fetching tournament config:', error);
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
    const userId = (session.user as { id?: string })?.id ?? '';
    if (!OWNER_IDS.includes(userId) || !OWNER_GUILD_IDS.includes(guildId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    // Only allow known fields — strip _id, __v, guildId, etc.
    const {
      enabled, channelId, messageTemplate, cronSchedule, reactionEmoji, messageMode, embedColor, titleText, footerText,
      participantRoleId, organizerRoleId, organizerUserIds, voiceChannelId,
    } = body;

    const oldConfig = await TournamentConfig.findOne({ guildId }).lean() as Record<string, unknown> | null;

    const nextConfig = {
      guildId,
      enabled,
      channelId: channelId || null,
      messageTemplate,
      cronSchedule,
      reactionEmoji,
      messageMode: messageMode === 'embed' ? 'embed' : 'text',
      embedColor: embedColor || '#3b82f6',
      titleText: titleText ?? '',
      footerText: footerText ?? '',
      participantRoleId: participantRoleId || null,
      organizerRoleId: organizerRoleId || null,
      organizerUserIds: Array.isArray(organizerUserIds) ? organizerUserIds : [],
      voiceChannelId: voiceChannelId || null,
    };

    const updatedConfig = await TournamentConfig.findOneAndUpdate(
      { guildId },
      nextConfig,
      { new: true, upsert: true }
    ).lean() as Record<string, unknown> | null;

    const changes = diffFields(oldConfig, nextConfig, [
      { field: 'enabled', label: 'Włączony' },
      { field: 'channelId', label: 'Kanał ogłoszeń' },
      { field: 'cronSchedule', label: 'Harmonogram (cron)' },
      { field: 'reactionEmoji', label: 'Emoji reakcji' },
      { field: 'messageMode', label: 'Tryb wiadomości' },
      { field: 'embedColor', label: 'Kolor embeda' },
      { field: 'titleText', label: 'Tytuł' },
      { field: 'footerText', label: 'Stopka' },
      { field: 'participantRoleId', label: 'Rola uczestnika' },
      { field: 'organizerRoleId', label: 'Rola organizatora' },
      { field: 'organizerUserIds', label: 'Liczba organizatorów' },
      { field: 'voiceChannelId', label: 'Kanał głosowy' },
      {
        field: 'messageTemplate',
        label: 'Szablon wiadomości',
        formatValue: (v: string) => (typeof v === 'string' && v.length > 60 ? `${v.slice(0, 60)}…` : v ?? 'brak'),
      },
    ]);

    await createAuditLog({
      guildId,
      userId: session.user.id!,
      username: session.user.name || 'Unknown',
      action: 'update',
      module: 'tournament',
      description: 'Zaktualizowano konfigurację turnieju',
      metadata: {
        enabled,
        cronSchedule,
      },
      changes,
    });

    return NextResponse.json({
      guildId,
      enabled: updatedConfig?.enabled ?? false,
      channelId: updatedConfig?.channelId || null,
      messageTemplate: updatedConfig?.messageTemplate || '',
      cronSchedule: updatedConfig?.cronSchedule || '25 20 * * 1',
      reactionEmoji: updatedConfig?.reactionEmoji || '🎮',
      messageMode: updatedConfig?.messageMode || 'text',
      embedColor: updatedConfig?.embedColor || '#3b82f6',
      titleText: updatedConfig?.titleText ?? '',
      footerText: updatedConfig?.footerText ?? '',
      participantRoleId: updatedConfig?.participantRoleId || null,
      organizerRoleId: updatedConfig?.organizerRoleId || null,
      organizerUserIds: updatedConfig?.organizerUserIds || [],
      voiceChannelId: updatedConfig?.voiceChannelId || null,
    });
  } catch (error) {
    console.error('Error updating tournament config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
