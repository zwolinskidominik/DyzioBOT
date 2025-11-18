import { Client } from 'discord.js';
import cron from 'node-cron';
import cache from '../../cache/xpCache';
import { LevelConfigModel } from '../../models/LevelConfig';
import { getUserXpMultiplier, getChannelXpMultiplier } from '../../utils/xpMultiplier';
import monthlyStatsCache from '../../cache/monthlyStatsCache';

export default function run(client: Client) {
  cron.schedule('*/30 * * * * *', async () => {
    const currentMonth = new Date().toISOString().slice(0, 7); // "2025-11"
    
    for (const guild of client.guilds.cache.values()) {
      const cfg = await LevelConfigModel.findOne({ guildId: guild.id }).lean();
      const xpPerMin = cfg?.xpPerMinVc ?? 10;
      const xpPerCheck = Math.round(xpPerMin / 2);

      for (const channel of guild.channels.cache.values()) {
        if (!channel.isVoiceBased()) continue;
        if (channel.id === guild.afkChannelId) continue;
        
        if (cfg?.ignoredChannels?.includes(channel.id)) continue;

        for (const member of channel.members.values()) {
          if (member.user.bot) continue;
          if (member.voice.serverMute || member.voice.serverDeaf) continue;
          
          if (cfg?.ignoredRoles?.some((roleId) => member.roles.cache.has(roleId))) continue;

          const roleMultiplier = await getUserXpMultiplier(member);
          const channelMultiplier = await getChannelXpMultiplier(guild.id, channel.id);
          const totalMultiplier = roleMultiplier * channelMultiplier;
          const finalXp = Math.round(xpPerCheck * totalMultiplier);

          await cache.addVcMin(guild.id, member.id, finalXp);
          
          monthlyStatsCache.addVoiceMinutes(guild.id, member.id, currentMonth, 0.5);
        }
      }
    }
  });
}
