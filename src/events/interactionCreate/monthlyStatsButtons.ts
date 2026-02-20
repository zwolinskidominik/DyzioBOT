import { ButtonInteraction, MessageFlags } from 'discord.js';
import { getBotConfig } from '../../config/bot';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import {
  getPersonalStats,
  getMonthString,
  formatVoiceTime,
  MONTH_NAMES,
} from '../../services/monthlyStatsService';
import logger from '../../utils/logger';

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

    const prevMonthStr = getMonthString(new Date(monthStr + '-01'), 1);
    const [prevYear, prevMonthNum] = prevMonthStr.split('-');
    const prevMonthName = MONTH_NAMES[prevMonthNum] || 'NIEZNANY';

    const [currentResult, prevResult] = await Promise.all([
      getPersonalStats(guildId, userId, monthStr),
      getPersonalStats(guildId, userId, prevMonthStr),
    ]);

    if (!currentResult.ok) {
      await interaction.editReply({
        content: `❌ Nie masz żadnych statystyk za ${monthName} ${year}.`,
      });
      return;
    }

    const current = currentResult.data;
    const prev = prevResult.ok ? prevResult.data : null;

    const currentMessageRank = current.messageRank;
    const prevMessageRank = prev ? prev.messageRank : 0;

    const currentVoiceRank = current.voiceRank;
    const prevVoiceRank = prev ? prev.voiceRank : 0;

    const messageDiff = prev ? current.messageCount - prev.messageCount : current.messageCount;
    const voiceDiff = prev ? current.voiceMinutes - prev.voiceMinutes : current.voiceMinutes;

    const rankDiffMsg = prevMessageRank > 0 ? prevMessageRank - currentMessageRank : 0;
    const rankDiffVoice = prevVoiceRank > 0 ? prevVoiceRank - currentVoiceRank : 0;

    const messagePercentage = ((current.messageCount / current.totalMessages) * 100).toFixed(2);

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

    const embed = createBaseEmbed({
      color: COLORS.GIVEAWAY,
      title: `📊 Twoje statystyki - ${monthName} ${year}`,
      description: `<@${userId}>`,
      footerText: `\u200b\nvs ${prevMonthName} ${prevYear}`,
    }).addFields(
        {
          name: '💬 Wiadomości',
          value: prev
            ? `**${current.messageCount.toLocaleString('pl-PL')}** (${formatDiff(messageDiff)})\n${rankDiffMsg !== 0 ? `${getRankEmoji(rankDiffMsg)} ` : ''}#${currentMessageRank} Miejsce${rankDiffMsg !== 0 ? ` (${formatDiff(rankDiffMsg)})` : ''}`
            : `**${current.messageCount.toLocaleString('pl-PL')}** wiadomości\n🆕 #${currentMessageRank} Miejsce`,
          inline: true,
        },
        {
          name: '🎤 Kanały głosowe',
          value: prev
            ? `**${formatVoiceTime(current.voiceMinutes)}** (${formatVoiceDiff(voiceDiff)})\n${rankDiffVoice !== 0 ? `${getRankEmoji(rankDiffVoice)} ` : ''}#${currentVoiceRank} Miejsce${rankDiffVoice !== 0 ? ` (${formatDiff(rankDiffVoice)})` : ''}`
            : `**${formatVoiceTime(current.voiceMinutes)}**\n🆕 #${currentVoiceRank} Miejsce`,
          inline: true,
        },
        {
          name: '📈 Udział',
          value: `**${messagePercentage}%** wszystkich wiadomości`,
          inline: false,
        }
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in handleDetails: ${error}`);
    await interaction.editReply({
      content: '❌ Wystąpił błąd podczas pobierania statystyk.',
    });
  }
}