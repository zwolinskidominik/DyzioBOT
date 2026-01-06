import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';
import TournamentConfig from '@/models/TournamentConfig';
import { createAuditLog } from '@/lib/auditLog';

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
      messageTemplate: (config as any)?.messageTemplate || defaultTemplate,
      cronSchedule: (config as any)?.cronSchedule || '25 20 * * 1',
      reactionEmoji: (config as any)?.reactionEmoji || '🎮',
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
    const body = await req.json();

    const updatedConfig = await TournamentConfig.findOneAndUpdate(
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
      module: 'tournament',
      description: 'Zaktualizowano konfigurację turnieju',
      metadata: {
        enabled: body.enabled,
        cronSchedule: body.cronSchedule,
      },
    });

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error('Error updating tournament config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
