import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';

/**
 * Returns the hardcoded guild-level tournament identifiers
 * (role IDs, organizer user IDs, voice channel ID) so the
 * dashboard preview can resolve them to actual names.
 */

interface GuildTournamentIds {
  tournamentParticipantsRoleId: string;
  tournamentOrganizerRoleId: string;
  organizerUserIds: string[];
  voiceChannelId: string;
}

const GUILD_TOURNAMENT_IDS: Record<string, GuildTournamentIds> = {
  // Main Server - GameZone
  '881293681783623680': {
    tournamentParticipantsRoleId: '881295994963243028',
    tournamentOrganizerRoleId: '1292916653377720400',
    organizerUserIds: ['813135633248682064', '725394084017209435', '518738731105124352'],
    voiceChannelId: '1394949230782845009',
  },
  // Test Server
  '1264582308003053570': {
    tournamentParticipantsRoleId: '1264582308149854219',
    tournamentOrganizerRoleId: '1373374228010897469',
    organizerUserIds: ['548177225661546496'],
    voiceChannelId: '1373099486238212126',
  },
};

const DEFAULTS: GuildTournamentIds = {
  tournamentParticipantsRoleId: '',
  tournamentOrganizerRoleId: '',
  organizerUserIds: [],
  voiceChannelId: '',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const ids = GUILD_TOURNAMENT_IDS[guildId] ?? DEFAULTS;

    return NextResponse.json(ids);
  } catch (error) {
    console.error('Error fetching tournament guild IDs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
