import { GuildMember } from 'discord.js';
import { LevelConfigModel } from '../models/LevelConfig';

export async function getUserXpMultiplier(member: GuildMember): Promise<number> {
  const config = await LevelConfigModel.findOne({ guildId: member.guild.id }).lean();
  
  if (!config || !config.roleMultipliers || config.roleMultipliers.length === 0) {
    return 1.0;
  }

  let maxMultiplier = 1.0;

  for (const roleMultiplier of config.roleMultipliers) {
    if (member.roles.cache.has(roleMultiplier.roleId)) {
      maxMultiplier = Math.max(maxMultiplier, roleMultiplier.multiplier);
    }
  }

  return maxMultiplier;
}

export async function getChannelXpMultiplier(guildId: string, channelId: string): Promise<number> {
  const config = await LevelConfigModel.findOne({ guildId }).lean();
  
  if (!config || !config.channelMultipliers || config.channelMultipliers.length === 0) {
    return 1.0;
  }

  const channelMultiplier = config.channelMultipliers.find(cm => cm.channelId === channelId);
  return channelMultiplier ? channelMultiplier.multiplier : 1.0;
}
