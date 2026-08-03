import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import cron from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { getBotConfig } from '../../config/bot';
import logger from '../../utils/logger';
import {
  getConfig,
  generateLeaderboard,
  getUserRank,
  isNewUser,
  getTrendEmoji,
  formatVoiceTime,
  getMonthString,
  MONTH_NAMES,
} from '../../services/monthlyStatsService';

export default function run(client: Client) {
  cron.schedule(CRON.MONTHLY_STATS_GENERATE, async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const cfgResult = await getConfig(guild.id);
        if (!cfgResult.ok || !cfgResult.data.enabled || !cfgResult.data.channelId) continue;
        const config = cfgResult.data;
        
        const channel = guild.channels.cache.get(config.channelId!) as TextChannel | undefined;
        if (!channel?.send) continue;
        
        const botCfg = getBotConfig(guild.client.user.id);
        const emojis = botCfg.emojis.monthlyStats;
        
        const now = new Date();
        const monthStr = getMonthString(now, 1);
        const [year, monthNum] = monthStr.split('-');
        const monthName = MONTH_NAMES[monthNum] || 'NIEZNANY';
        
        const lbResult = await generateLeaderboard(guild.id, monthStr, config.topCount);
        if (!lbResult.ok) continue;
        const { topMessages, topVoice, totalMessages } = lbResult.data;
        
        if (topMessages.length === 0 && topVoice.length === 0) {
          continue;
        }
        
        const prevMonthStr = getMonthString(now, 2);
        
        let message = `# 📊 TOPKA ${monthName} ${year}\n\n`;
        
        if (topMessages.length > 0) {
          message += `**Liczba wiadomości napisanych w tym miesiącu:**\n`;
          message += `## ${totalMessages.toLocaleString('pl-PL')} ✉️\n\n`;
          message += `### TOP ${config.topCount} użytkowników na kanałach tekstowych\n`;
          
          for (let i = 0; i < topMessages.length; i++) {
            const stat = topMessages[i];
            const prevRank = await getUserRank(guild.id, stat.userId, prevMonthStr, 'messages');
            const isNew_ = await isNewUser(guild.id, stat.userId);
            const emoji = getTrendEmoji(i + 1, prevRank, isNew_, emojis);
            message += `${emoji} <@${stat.userId}> – ${stat.messageCount.toLocaleString('pl-PL')} ✉️\n`;
          }
        }
        
        if (topVoice.length > 0) {
          message += `\n### TOP ${config.topCount} użytkowników na kanałach głosowych\n`;
          
          for (let i = 0; i < topVoice.length; i++) {
            const stat = topVoice[i];
            const prevRank = await getUserRank(guild.id, stat.userId, prevMonthStr, 'voice');
            const isNew_ = await isNewUser(guild.id, stat.userId);
            const emoji = getTrendEmoji(i + 1, prevRank, isNew_, emojis);
            const timeStr = formatVoiceTime(stat.voiceMinutes);
            message += `${emoji} <@${stat.userId}> – ${timeStr} ⌛\n`;
          }
          message += '\u200b\n';
        }
        
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`monthly_stats:details:${monthStr}`)
            .setLabel('Twoje statystyki')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Primary)
        );
        
        await channel.send({ 
          content: message,
          components: [buttons]
        });
        
      } catch (error) {
        logger.error(`Błąd generowania statystyk miesięcznych dla guild=${guild.id}: ${error}`);
      }
    }
  });
}
