import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AttachmentBuilder, TextChannel } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createErrorEmbed } from '../../utils/embedHelpers';
import {
  getConfig,
  generateLeaderboard,
  getUserRank,
  isNewUser,
  getPersonalStats,
  getMonthString,
  MONTH_NAMES,
} from '../../services/monthlyStatsService';
import { MonthlyTopkaCard, TopkaCardEntry } from '../../utils/canvasMonthlyTopkaCard';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('topka-test')
  .setDescription('Wygeneruj testową grafikę miesięcznej Topki')
  .addIntegerOption((option) =>
    option
      .setName('miesiace_wstecz')
      .setDescription('0 = bieżący miesiąc, 1 = poprzedni (domyślnie: bieżący)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(11),
  )
  .addBooleanOption((option) =>
    option
      .setName('publicznie')
      .setDescription('Wyślij na skonfigurowany kanał Topki zamiast tylko podglądu dla Ciebie (domyślnie: nie)')
      .setRequired(false),
  )
  .addBooleanOption((option) =>
    option
      .setName('testowe-dane')
      .setDescription('Losowe dane testowe (prawdziwi członkowie, losowe liczby) zamiast realnych statystyk')
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
  cooldown: 15,
  guildOnly: true,
  ownerOnly: true,
};

async function buildEntries(
  guild: NonNullable<ICommandOptions['interaction']['guild']>,
  guildId: string,
  stats: { userId: string; messageCount: number; voiceMinutes: number }[],
  type: 'messages' | 'voice',
  prevMonthStr: string,
): Promise<TopkaCardEntry[]> {
  return Promise.all(
    stats.map(async (stat, index) => {
      const [prevRank, isNew_, prevStatsResult, user] = await Promise.all([
        getUserRank(guildId, stat.userId, prevMonthStr, type),
        isNewUser(guildId, stat.userId),
        getPersonalStats(guildId, stat.userId, prevMonthStr),
        guild.members
          .fetch(stat.userId)
          .then((m) => m.user)
          .catch(() => guild.client.users.fetch(stat.userId).catch(() => null)),
      ]);

      const prevValue = prevStatsResult.ok
        ? type === 'messages'
          ? prevStatsResult.data.messageCount
          : prevStatsResult.data.voiceMinutes
        : 0;

      return {
        userId: stat.userId,
        username: user?.username ?? 'Nieznany użytkownik',
        avatarURL: user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png',
        value: type === 'messages' ? stat.messageCount : stat.voiceMinutes,
        rank: index + 1,
        prevRank,
        prevValue,
        isNew: isNew_,
      };
    }),
  );
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FALLBACK_AVATARS = [0, 1, 2, 3, 4, 5].map(
  (i) => `https://cdn.discordapp.com/embed/avatars/${i}.png`,
);

/**
 * Losowe, ale realistyczne dane do podglądu wyglądu — bez żadnego odczytu/zapisu w bazie.
 * Używa prawdziwych członków serwera (avatary, nazwy), żeby podgląd wyglądał wiarygodnie.
 */
async function buildMockEntries(
  guild: NonNullable<ICommandOptions['interaction']['guild']>,
  topCount: number,
  type: 'messages' | 'voice',
): Promise<TopkaCardEntry[]> {
  const fetched = await guild.members.fetch({ limit: 50 }).catch(() => null);
  const humans = fetched ? [...fetched.values()].filter((m) => !m.user.bot) : [];
  const shuffled = [...humans].sort(() => Math.random() - 0.5);

  const picks = Array.from({ length: topCount }, (_, i) => {
    const member = shuffled[i];
    return member
      ? { username: member.user.username, avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 128 }) }
      : { username: `Testowy Użytkownik ${i + 1}`, avatarURL: FALLBACK_AVATARS[i % FALLBACK_AVATARS.length] };
  });

  let value = type === 'messages' ? randomInt(280, 700) : randomInt(6000, 18000);
  const values = picks.map(() => {
    value = Math.max(5, value - randomInt(10, type === 'messages' ? 70 : 900));
    return value;
  });

  return picks.map((p, i) => {
    const rank = i + 1;
    const isNew = Math.random() < 0.15;
    const prevRank = isNew ? 0 : Math.max(0, Math.min(topCount + 2, rank + randomInt(-3, 3)));
    const prevValue = isNew ? 0 : Math.max(0, values[i] - randomInt(-150, 300));

    return {
      userId: `mock-${type}-${i}`,
      username: p.username,
      avatarURL: p.avatarURL,
      value: values[i],
      rank,
      prevRank,
      prevValue,
      isNew,
    };
  });
}

export async function run({ interaction }: ICommandOptions): Promise<void> {
  if (!interaction.guild) return;

  const guild = interaction.guild;
  const guildId = guild.id;
  const monthsAgo = interaction.options.getInteger('miesiace_wstecz') ?? 0;
  const postPublicly = interaction.options.getBoolean('publicznie') ?? false;
  const useMockData = interaction.options.getBoolean('testowe-dane') ?? false;

  if (useMockData && postPublicly) {
    await interaction.reply({
      embeds: [createErrorEmbed('Danych testowych nie można wysłać publicznie — wybierz tylko jedną z opcji.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const now = new Date();
    const monthStr = getMonthString(now, monthsAgo);
    const prevMonthStr = getMonthString(now, monthsAgo + 1);
    const [year, monthNum] = monthStr.split('-');
    const monthName = MONTH_NAMES[monthNum] || 'NIEZNANY';

    const cfgResult = await getConfig(guildId);
    const topCount = cfgResult.ok ? cfgResult.data.topCount : 10;

    let messagesEntries: TopkaCardEntry[];
    let voiceEntries: TopkaCardEntry[];
    let totalMessages: number;

    if (useMockData) {
      [messagesEntries, voiceEntries] = await Promise.all([
        buildMockEntries(guild, topCount, 'messages'),
        buildMockEntries(guild, topCount, 'voice'),
      ]);
      totalMessages = messagesEntries.reduce((sum, e) => sum + e.value, 0) + randomInt(500, 3000);
    } else {
      const lbResult = await generateLeaderboard(guildId, monthStr, topCount);
      if (!lbResult.ok) {
        await interaction.editReply({ embeds: [createErrorEmbed(lbResult.message)] });
        return;
      }

      const { topMessages, topVoice } = lbResult.data;

      if (topMessages.length === 0 && topVoice.length === 0) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              `Brak statystyk za ${monthName} ${year}. Bot musi najpierw zebrać dane (wiadomości / czas na kanałach głosowych), albo użyj opcji „testowe-dane".`,
            ),
          ],
        });
        return;
      }

      [messagesEntries, voiceEntries] = await Promise.all([
        buildEntries(guild, guildId, topMessages, 'messages', prevMonthStr),
        buildEntries(guild, guildId, topVoice, 'voice', prevMonthStr),
      ]);
      totalMessages = lbResult.data.totalMessages;
    }

    const card = new MonthlyTopkaCard({
      monthName,
      year,
      totalMessages,
      messagesEntries,
      voiceEntries,
      botId: interaction.client.user.id,
    });

    const imageBuffer = await card.build();
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'topka-test.png' });

    if (!postPublicly) {
      const label = useMockData
        ? `🧪 Podgląd Topki (${monthName} ${year}) na **losowych danych testowych** — widoczny tylko dla Ciebie:`
        : `🧪 Podgląd testowy Topki (${monthName} ${year}) — widoczny tylko dla Ciebie:`;
      await interaction.editReply({ content: label, files: [attachment] });
      logger.info(
        `[TOPKA-TEST] Podgląd (${useMockData ? 'mock' : 'real'}) wygenerowany przez ${interaction.user.id} w guild=${guildId}.`,
      );
      return;
    }

    if (!cfgResult.ok || !cfgResult.data.channelId) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Skonfiguruj najpierw kanał Statystyk Miesięcznych w dashboardzie, zanim wyślesz publicznie.',
          ),
        ],
      });
      return;
    }

    const channel = guild.channels.cache.get(cfgResult.data.channelId) as TextChannel | undefined;
    if (!channel?.send) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Skonfigurowany kanał Topki nie istnieje lub bot nie ma do niego dostępu.')],
      });
      return;
    }

    await channel.send({
      content: `# 🧪 [TEST] Topka — **${guild.name}**\nTo jest testowa wysyłka (grafika, wersja eksperymentalna) wywołana przez ${interaction.user}.`,
      files: [attachment],
    });

    await interaction.editReply({ content: `✅ Testowa grafika Topki wysłana na ${channel}.` });
    logger.info(`[TOPKA-TEST] Publiczny test wysłany przez ${interaction.user.id} na #${channel.name} (guild=${guildId}).`);
  } catch (error) {
    logger.error(`[TOPKA-TEST] Błąd wykonania komendy w guild=${guildId}: ${error}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie udało się wygenerować testowej grafiki Topki. Spróbuj ponownie.')],
    });
  }
}
