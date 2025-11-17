import { Message } from 'discord.js';
import cache from '../../cache/xpCache';
import { LevelConfigModel } from '../../models/LevelConfig';
import { LevelModel } from '../../models/Level';
import { getUserXpMultiplier, getChannelXpMultiplier } from '../../utils/xpMultiplier';
import monthlyStatsCache from '../../cache/monthlyStatsCache';

export default async function run(message: Message) {
  if (message.author.bot || !message.guild || !message.member) return;

  const cfg = await LevelConfigModel.findOne({ guildId: message.guild.id }).lean();
  
  if (cfg?.ignoredChannels?.includes(message.channelId)) return;
  
  if (cfg?.ignoredRoles?.some((roleId) => message.member!.roles.cache.has(roleId))) return;
  
  const xpPerMsg = cfg?.xpPerMsg ?? 5;
  const cooldown = cfg?.cooldownSec ?? 0;

  const lvl = await LevelModel.findOne({ guildId: message.guild.id, userId: message.author.id }).select(
    'lastMessageTs'
  );
  if (lvl?.lastMessageTs && Date.now() - lvl.lastMessageTs.getTime() < cooldown * 1000) return;

  const roleMultiplier = await getUserXpMultiplier(message.member);
  const channelMultiplier = await getChannelXpMultiplier(message.guild.id, message.channelId);
  const totalMultiplier = roleMultiplier * channelMultiplier;
  const finalXp = Math.round(xpPerMsg * totalMultiplier);

  await cache.addMsg(message.guild.id, message.author.id, finalXp);

  const currentMonth = new Date().toISOString().slice(0, 7);
  monthlyStatsCache.addMessage(message.guild.id, message.author.id, currentMonth);
}
