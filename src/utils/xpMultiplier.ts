import { GuildMember } from 'discord.js';

interface MultiplierConfig {
  roleMultipliers?: { roleId: string; multiplier: number }[];
  channelMultipliers?: { channelId: string; multiplier: number }[];
}

export function getXpMultipliers(
  member: GuildMember,
  channelId: string,
  config: MultiplierConfig | null | undefined
): { role: number; channel: number } {
  if (!config) return { role: 1.0, channel: 1.0 };

  let role = 1.0;
  if (config.roleMultipliers) {
    for (const rm of config.roleMultipliers) {
      if (member.roles.cache.has(rm.roleId)) {
        role = Math.max(role, rm.multiplier);
      }
    }
  }

  let channel = 1.0;
  const cm = config.channelMultipliers?.find(c => c.channelId === channelId);
  if (cm) channel = cm.multiplier;

  return { role, channel };
}
