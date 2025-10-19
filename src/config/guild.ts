import type { IGuildConfig } from '../interfaces/GuildConfig';

const GUILD_ASSETS: Record<string, IGuildConfig> = {
  // Main Server - GameZone
  '881293681783623680': {
    roles: {
      owner: '881295973782007868',
      admin: '881295975036104766',
      mod: '1232441670193250425',
      partnership: '1290788899991584778',
    },
    channels: {
      boostNotification: '1292423972859940966',
      boosterList: '1196291091280973895',
      tournamentRules: '1136325348246683658',
    },
  },

  // Test Server
  '1264582308003053570': {
    roles: {
      owner: '1264582308263100482',
      admin: '1264582308263100481',
      mod: '1264582308263100480',
      partnership: '1264582308191539249',
    },
    channels: {
      boostNotification: '1370037656402001971',
      boosterList: '1264582308552376436',
      tournamentRules: '1264582309819060246',
    },
  },
};

const DEFAULTS: IGuildConfig = {
  roles: { owner: '', admin: '', mod: '', partnership: '' },
  channels: { boostNotification: '', boosterList: '', tournamentRules: '' },
};

export function getGuildConfig(guildId: string): IGuildConfig {
  const found = GUILD_ASSETS[guildId];
  if (!found) return { ...DEFAULTS, roles: { ...DEFAULTS.roles }, channels: { ...DEFAULTS.channels } };
  return {
    roles: { ...DEFAULTS.roles, ...(found.roles ?? {}) },
    channels: { ...DEFAULTS.channels, ...(found.channels ?? {}) },
  };
}

// Test-only helper: allow tests to inspect/mutate assets for partial config scenarios
export function __getGuildAssetsUnsafeForTests(): Record<string, IGuildConfig> {
  return GUILD_ASSETS as any;
}
