import { Client } from 'discord.js';
import cron from 'node-cron';
import { CRON } from '../../config/constants/cron';
import cache from '../../cache/xpCache';
import { getConfig } from '../../services/xpService';
import { getXpMultipliers } from '../../utils/xpMultiplier';
import monthlyStatsCache from '../../cache/monthlyStatsCache';

export default function run(client: Client) {
  cron.schedule(CRON.VC_MINUTE_TICK, async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    for (const guild of client.guilds.cache.values()) {
      const cfg = await getConfig(guild.id);
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

          const { role: roleMultiplier, channel: channelMultiplier } = getXpMultipliers(member, channel.id, cfg);
          const totalMultiplier = roleMultiplier * channelMultiplier;
          const finalXp = Math.round(xpPerCheck * totalMultiplier);

          await cache.addVcMin(guild.id, member.id, finalXp);
          
          monthlyStatsCache.addVoiceMinutes(guild.id, member.id, currentMonth, 0.5);
        }
      }
    }
  });
}
