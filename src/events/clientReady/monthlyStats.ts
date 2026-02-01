import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import cron from 'node-cron';
import { MonthlyStatsModel } from '../../models/MonthlyStats';
import { MonthlyStatsConfigModel } from '../../models/MonthlyStatsConfig';
import { getBotConfig } from '../../config/bot';

const MONTH_NAMES: { [key: string]: string } = {
  '01': 'STYCZEŃ',
  '02': 'LUTY',
  '03': 'MARZEC',
  '04': 'KWIECIEŃ',
  '05': 'MAJ',
  '06': 'CZERWIEC',
  '07': 'LIPIEC',
  '08': 'SIERPIEŃ',
  '09': 'WRZESIEŃ',
  '10': 'PAŹDZIERNIK',
  '11': 'LISTOPAD',
  '12': 'GRUDZIEŃ',
};

async function getMonthlyStats(guildId: string, month: string, topCount: number) {
  const stats = await MonthlyStatsModel.find({ guildId, month }).lean();
  
  const topMessages = stats
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, topCount);
  
  const topVoice = stats
    .sort((a, b) => b.voiceMinutes - a.voiceMinutes)
    .slice(0, topCount);
  
  const totalMessages = stats.reduce((sum, s) => sum + s.messageCount, 0);
  
  return { topMessages, topVoice, totalMessages };
}

async function getPreviousMonthRank(guildId: string, userId: string, previousMonth: string, type: 'messages' | 'voice') {
  const stats = await MonthlyStatsModel.find({ guildId, month: previousMonth }).lean();
  
  if (type === 'messages') {
    const sorted = stats.sort((a, b) => b.messageCount - a.messageCount);
    return sorted.findIndex(s => s.userId === userId) + 1;
  } else {
    const sorted = stats.sort((a, b) => b.voiceMinutes - a.voiceMinutes);
    return sorted.findIndex(s => s.userId === userId) + 1;
  }
}

async function isNewUser(guildId: string, userId: string): Promise<boolean> {
  const count = await MonthlyStatsModel.countDocuments({ guildId, userId });
  return count <= 1;
}

function getTrendEmoji(
  currentRank: number, 
  previousRank: number, 
  isNew: boolean,
  emojis: { upvote: string; downvote: string; whitedash: string; new: string }
): string {
  if (isNew) return emojis.new;
  if (previousRank === 0) return emojis.upvote;
  if (currentRank < previousRank) return emojis.upvote;
  if (currentRank > previousRank) return emojis.downvote;
  return emojis.whitedash;
}

export default function run(client: Client) {
  cron.schedule('0 12 1 * *', async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await MonthlyStatsConfigModel.findOne({ guildId: guild.id }).lean();
        
        if (!config?.enabled || !config.channelId) continue;
        
        const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
        if (!channel?.send) continue;
        
        const botCfg = getBotConfig(guild.client.user.id);
        const emojis = botCfg.emojis.monthlyStats;
        
        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        const monthStr = now.toISOString().slice(0, 7);
        const [year, monthNum] = monthStr.split('-');
        const monthName = MONTH_NAMES[monthNum] || 'NIEZNANY';
        
        const { topMessages, topVoice, totalMessages } = await getMonthlyStats(
          guild.id, 
          monthStr, 
          config.topCount
        );
        
        if (topMessages.length === 0 && topVoice.length === 0) {
          continue;
        }
        
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const prevMonthStr = twoMonthsAgo.toISOString().slice(0, 7);
        
        let message = `# 📊 TOPKA ${monthName} ${year}\n\n`;
        
        if (topMessages.length > 0) {
          message += `**Liczba wiadomości napisanych w tym miesiącu:**\n`;
          message += `## ${totalMessages.toLocaleString('pl-PL')} ✉️\n\n`;
          message += `### TOP ${config.topCount} użytkowników na kanałach tekstowych\n`;
          
          for (let i = 0; i < topMessages.length; i++) {
            const stat = topMessages[i];
            const prevRank = await getPreviousMonthRank(guild.id, stat.userId, prevMonthStr, 'messages');
            const isNew = await isNewUser(guild.id, stat.userId);
            const emoji = getTrendEmoji(i + 1, prevRank, isNew, emojis);
            message += `${emoji} <@${stat.userId}> – ${stat.messageCount.toLocaleString('pl-PL')} ✉️\n`;
          }
        }
        
        if (topVoice.length > 0) {
          message += `\n### TOP ${config.topCount} użytkowników na kanałach głosowych\n`;
          
          for (let i = 0; i < topVoice.length; i++) {
            const stat = topVoice[i];
            const prevRank = await getPreviousMonthRank(guild.id, stat.userId, prevMonthStr, 'voice');
            const isNew = await isNewUser(guild.id, stat.userId);
            const emoji = getTrendEmoji(i + 1, prevRank, isNew, emojis);
            const totalMinutes = stat.voiceMinutes;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = Math.floor(totalMinutes % 60);
            const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}h`;
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
        
      } catch (error) {}
    }
  });
}
