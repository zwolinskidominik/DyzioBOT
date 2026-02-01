import { ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { MonthlyStatsModel } from '../../models/MonthlyStats';
import { getBotConfig } from '../../config/bot';

const MONTH_NAMES: { [key: string]: string } = {
  '01': 'STYCZEŃ', '02': 'LUTY', '03': 'MARZEC', '04': 'KWIECIEŃ',
  '05': 'MAJ', '06': 'CZERWIEC', '07': 'LIPIEC', '08': 'SIERPIEŃ',
  '09': 'WRZESIEŃ', '10': 'PAŹDZIERNIK', '11': 'LISTOPAD', '12': 'GRUDZIEŃ',
};

export default async function run(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('monthly_stats:')) return;

  const [, action, monthStr] = interaction.customId.split(':');
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (action === 'details') {
    await handleDetails(interaction, guildId, userId, monthStr);
  }
}

async function handleDetails(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
  monthStr: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const [year, monthNum] = monthStr.split('-');
    const monthName = MONTH_NAMES[monthNum] || 'NIEZNANY';

    const currentMonth = new Date(monthStr);
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    const prevMonthStr = currentMonth.toISOString().slice(0, 7);
    const [prevYear, prevMonthNum] = prevMonthStr.split('-');
    const prevMonthName = MONTH_NAMES[prevMonthNum] || 'NIEZNANY';

    const [currentStats, prevStats] = await Promise.all([
      MonthlyStatsModel.find({ guildId, month: monthStr }).lean(),
      MonthlyStatsModel.find({ guildId, month: prevMonthStr }).lean(),
    ]);

    const userCurrent = currentStats.find(s => s.userId === userId);
    const userPrev = prevStats.find(s => s.userId === userId);

    if (!userCurrent) {
      await interaction.editReply({
        content: `❌ Nie masz żadnych statystyk za ${monthName} ${year}.`,
      });
      return;
    }

    const currentMessagesSorted = [...currentStats].sort((a, b) => b.messageCount - a.messageCount);
    const prevMessagesSorted = [...prevStats].sort((a, b) => b.messageCount - a.messageCount);

    const currentMessageRank = currentMessagesSorted.findIndex(s => s.userId === userId) + 1;
    const prevMessageRank = userPrev ? prevMessagesSorted.findIndex(s => s.userId === userId) + 1 : 0;

    const currentVoiceSorted = [...currentStats].sort((a, b) => b.voiceMinutes - a.voiceMinutes);
    const prevVoiceSorted = [...prevStats].sort((a, b) => b.voiceMinutes - a.voiceMinutes);

    const currentVoiceRank = currentVoiceSorted.findIndex(s => s.userId === userId) + 1;
    const prevVoiceRank = userPrev ? prevVoiceSorted.findIndex(s => s.userId === userId) + 1 : 0;

    const messageDiff = userPrev ? userCurrent.messageCount - userPrev.messageCount : userCurrent.messageCount;
    const voiceDiff = userPrev ? userCurrent.voiceMinutes - userPrev.voiceMinutes : userCurrent.voiceMinutes;

    const rankDiffMsg = prevMessageRank > 0 ? prevMessageRank - currentMessageRank : 0;
    const rankDiffVoice = prevVoiceRank > 0 ? prevVoiceRank - currentVoiceRank : 0;

    const totalMessages = currentStats.reduce((sum, s) => sum + s.messageCount, 0);
    const messagePercentage = ((userCurrent.messageCount / totalMessages) * 100).toFixed(2);

    const botCfg = getBotConfig(interaction.client.user.id);

    const getRankEmoji = (diff: number) => {
      if (diff > 0) return botCfg.emojis.monthlyStats.upvote;
      if (diff < 0) return botCfg.emojis.monthlyStats.downvote;
      return botCfg.emojis.monthlyStats.whitedash;
    };

    const formatDiff = (diff: number, prefix: string = '') => {
      if (diff > 0) return `+${diff.toLocaleString('pl-PL')}${prefix}`;
      if (diff < 0) return `${diff.toLocaleString('pl-PL')}${prefix}`;
      return `${diff}${prefix}`;
    };

    const formatVoiceDiff = (minutes: number) => {
      const absDiff = Math.abs(minutes);
      const sign = minutes > 0 ? '+' : minutes < 0 ? '-' : '';
      
      if (absDiff >= 60) {
        const hours = Math.floor(absDiff / 60);
        const mins = Math.floor(absDiff % 60);
        const timeStr = mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}h` : `${hours}h`;
        return `${sign}${timeStr}`;
      }
      
      return `${sign}${absDiff} min`;
    };

    const formatVoiceTime = (minutes: number) => {
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}h` : `${hours}h`;
      }
      return `${minutes} min`;
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📊 Twoje statystyki - ${monthName} ${year}`)
      .setDescription(`<@${userId}>`)
      .addFields(
        {
          name: '💬 Wiadomości',
          value: userPrev
            ? `**${userCurrent.messageCount.toLocaleString('pl-PL')}** (${formatDiff(messageDiff)})\n${rankDiffMsg !== 0 ? `${getRankEmoji(rankDiffMsg)} ` : ''}#${currentMessageRank} Miejsce${rankDiffMsg !== 0 ? ` (${formatDiff(rankDiffMsg)})` : ''}`
            : `**${userCurrent.messageCount.toLocaleString('pl-PL')}** wiadomości\n🆕 #${currentMessageRank} Miejsce`,
          inline: true,
        },
        {
          name: '🎤 Kanały głosowe',
          value: userPrev
            ? `**${formatVoiceTime(userCurrent.voiceMinutes)}** (${formatVoiceDiff(voiceDiff)})\n${rankDiffVoice !== 0 ? `${getRankEmoji(rankDiffVoice)} ` : ''}#${currentVoiceRank} Miejsce${rankDiffVoice !== 0 ? ` (${formatDiff(rankDiffVoice)})` : ''}`
            : `**${formatVoiceTime(userCurrent.voiceMinutes)}**\n🆕 #${currentVoiceRank} Miejsce`,
          inline: true,
        },
        {
          name: '📈 Udział',
          value: `**${messagePercentage}%** wszystkich wiadomości`,
          inline: false,
        }
      )
      .setFooter({ text: `\u200b\nvs ${prevMonthName} ${prevYear}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleDetails:', error);
    await interaction.editReply({
      content: '❌ Wystąpił błąd podczas pobierania statystyk.',
    });
  }
}