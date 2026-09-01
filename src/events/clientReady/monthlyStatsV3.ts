import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import cron from 'node-cron';
import { CRON } from '../../config/constants/cron';
import logger from '../../utils/logger';
import {
  getConfig,
  generateCombinedLeaderboard,
  getMonthString,
  MONTH_NAMES,
} from '../../services/monthlyStatsService';
import { MonthlyTopkaCardV3, TopkaV3Entry } from '../../utils/canvasMonthlyTopkaCardV3';

/**
 * Produkcyjny cron v3 (grafika, jeden łączony ranking) — NASTĘPCA `monthlyStats.ts`
 * (tekstowa wersja, wyłączona przez ENABLED=false w tamtym pliku, ale zostawiona
 * na wypadek powrotu do starego formatu).
 */

const MAX_TOP_COUNT = 15;

function toSentenceCase(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase();
}

export default function run(client: Client) {
  cron.schedule(CRON.MONTHLY_STATS_GENERATE, async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const cfgResult = await getConfig(guild.id);
        if (!cfgResult.ok || !cfgResult.data.enabled || !cfgResult.data.channelId) continue;
        const config = cfgResult.data;

        const channel = guild.channels.cache.get(config.channelId!) as TextChannel | undefined;
        if (!channel?.send) continue;

        const now = new Date();
        const monthStr = getMonthString(now, 1);
        const [year, monthNum] = monthStr.split('-');
        const monthName = toSentenceCase(MONTH_NAMES[monthNum] || 'Nieznany');
        const topCount = Math.min(config.topCount, MAX_TOP_COUNT);

        const lbResult = await generateCombinedLeaderboard(
          guild.id,
          monthStr,
          topCount,
          config.msgRate,
          config.voiceRate,
        );
        if (!lbResult.ok || lbResult.data.ranked.length === 0) continue;

        const { ranked, totalMessages, totalVoiceMinutes, activeUsers } = lbResult.data;

        const entries: TopkaV3Entry[] = await Promise.all(
          ranked.map(async (r) => {
            const user = await guild.members
              .fetch(r.userId)
              .then((m) => m.user)
              .catch(() => guild.client.users.fetch(r.userId).catch(() => null));

            return {
              userId: r.userId,
              username: user?.username ?? 'Nieznany użytkownik',
              avatarURL:
                user?.displayAvatarURL({ extension: 'png', size: 128 }) ??
                'https://cdn.discordapp.com/embed/avatars/0.png',
              messageCount: r.messageCount,
              voiceMinutes: r.voiceMinutes,
              score: r.score,
            };
          }),
        );

        const card = new MonthlyTopkaCardV3({
          guildName: guild.name,
          guildIconURL: guild.iconURL({ extension: 'png', size: 128 }),
          monthName,
          year,
          totalMessages,
          totalVoiceMinutes,
          activeUsers,
          entries,
          msgRate: config.msgRate,
          voiceRate: config.voiceRate,
        });

        const imageBuffer = await card.build();
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'topka-miesiaca.png' });

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`monthly_stats:details:${monthStr}`)
            .setLabel('Twoje statystyki')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Primary),
        );

        await channel.send({
          content: `# 📊 TOPKA ${MONTH_NAMES[monthNum] || 'NIEZNANY'} ${year}`,
          files: [attachment],
          components: [buttons],
        });
      } catch (error) {
        logger.error(`Błąd generowania statystyk miesięcznych v3 dla guild=${guild.id}: ${error}`);
      }
    }
  });
}
