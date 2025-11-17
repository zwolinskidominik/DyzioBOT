import type { IGuildConfig } from '../interfaces/GuildConfig';

const GUILD_ASSETS: Record<string, IGuildConfig> = {
  // Main Server - GameZone
  '881293681783623680': {
    roles: {
      owner: '881295973782007868',
      admin: '881295975036104766',
      mod: '1232441670193250425',
      partnership: '1290788899991584778',
      tournamentParticipants: '881295994963243028',
      tournamentOrganizer: '1292916653377720400',
    },
    channels: {
      boostNotification: '1292423972859940966',
      boosterList: '1196291091280973895',
      tournamentRules: '1136325348246683658',
      tournamentVoice: '1394949230782845009',
    },
    tournament: {
      organizerUserIds: ['813135633248682064', '725394084017209435', '518738731105124352'],
    },
  },

  // Test Server
  '1264582308003053570': {
    roles: {
      owner: '1264582308263100482',
      admin: '1264582308263100481',
      mod: '1264582308263100480',
      partnership: '1264582308191539249',
      tournamentParticipants: '1264582308149854219',
      tournamentOrganizer: '1373374228010897469',
    },
    channels: {
      boostNotification: '1370037656402001971',
      boosterList: '1264582308552376436',
      tournamentRules: '1264582309819060246',
      tournamentVoice: '1373099486238212126',
    },
    tournament: {
      organizerUserIds: ['548177225661546496'],
    },
  },
};

const DEFAULTS: IGuildConfig = {
  roles: { owner: '', admin: '', mod: '', partnership: '', tournamentParticipants: '', tournamentOrganizer: '' },
  channels: { boostNotification: '', boosterList: '', tournamentRules: '', tournamentVoice: '' },
  tournament: { organizerUserIds: [] },
};

export function getGuildConfig(guildId: string): IGuildConfig {
  const found = GUILD_ASSETS[guildId];
  if (!found) return { ...DEFAULTS, roles: { ...DEFAULTS.roles }, channels: { ...DEFAULTS.channels }, tournament: { ...DEFAULTS.tournament } };
  return {
    roles: { ...DEFAULTS.roles, ...(found.roles ?? {}) },
    channels: { ...DEFAULTS.channels, ...(found.channels ?? {}) },
    tournament: { ...DEFAULTS.tournament, ...(found.tournament ?? {}) },
  };
}

// Test-only helper: allow tests to inspect/mutate assets for partial config scenarios
export function __getGuildAssetsUnsafeForTests(): Record<string, IGuildConfig> {
  return GUILD_ASSETS as any;
}
