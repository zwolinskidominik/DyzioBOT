import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AttachmentBuilder, TextChannel } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createErrorEmbed } from '../../utils/embedHelpers';
import {
  getConfig,
  generateCombinedLeaderboard,
  computeCombinedScore,
  getMonthString,
  MONTH_NAMES,
} from '../../services/monthlyStatsService';
import { MonthlyTopkaCardV3, TopkaV3Entry } from '../../utils/canvasMonthlyTopkaCardV3';
import logger from '../../utils/logger';

const MAX_TOP_COUNT = 15;

function toSentenceCase(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase();
}

export const data = new SlashCommandBuilder()
  .setName('topka-test-v3')
  .setDescription('Wygeneruj testową grafikę Topki v3 z podium')
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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FALLBACK_AVATARS = [0, 1, 2, 3, 4, 5].map((i) => `https://cdn.discordapp.com/embed/avatars/${i}.png`);

async function buildMockEntries(
  guild: NonNullable<ICommandOptions['interaction']['guild']>,
  topCount: number,
  msgRate: number,
  voiceRate: number,
): Promise<TopkaV3Entry[]> {
  const fetched = await guild.members.fetch({ limit: 50 }).catch(() => null);
  const humans = fetched ? [...fetched.values()].filter((m) => !m.user.bot) : [];
  const shuffled = [...humans].sort(() => Math.random() - 0.5);

  const picks = Array.from({ length: topCount }, (_, i) => {
    const member = shuffled[i];
    return member
      ? { userId: member.id, username: member.user.username, avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 128 }) }
      : {
          userId: `mock-${i}`,
          username: `Testowy Użytkownik ${i + 1}`,
          avatarURL: FALLBACK_AVATARS[i % FALLBACK_AVATARS.length],
        };
  });

  const entries = picks.map((p) => {
    const messageCount = randomInt(30, 700);
    const voiceMinutes = randomInt(0, 12000);
    return {
      userId: p.userId,
      username: p.username,
      avatarURL: p.avatarURL,
      messageCount,
      voiceMinutes,
      score: computeCombinedScore(messageCount, voiceMinutes, msgRate, voiceRate),
    };
  });

  return entries.sort((a, b) => b.score - a.score);
}

async function buildRealEntries(
  guild: NonNullable<ICommandOptions['interaction']['guild']>,
  ranked: { userId: string; messageCount: number; voiceMinutes: number; score: number }[],
): Promise<TopkaV3Entry[]> {
  return Promise.all(
    ranked.map(async (r) => {
      const user = await guild.members
        .fetch(r.userId)
        .then((m) => m.user)
        .catch(() => guild.client.users.fetch(r.userId).catch(() => null));

      return {
        userId: r.userId,
        username: user?.username ?? 'Nieznany użytkownik',
        avatarURL: user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png',
        messageCount: r.messageCount,
        voiceMinutes: r.voiceMinutes,
        score: r.score,
      };
    }),
  );
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
    const [year, monthNum] = monthStr.split('-');
    const monthName = toSentenceCase(MONTH_NAMES[monthNum] || 'Nieznany');

    const cfgResult = await getConfig(guildId);
    const topCount = Math.min(cfgResult.ok ? cfgResult.data.topCount : 10, MAX_TOP_COUNT);
    const msgRate = cfgResult.ok ? cfgResult.data.msgRate : 1;
    const voiceRate = cfgResult.ok ? cfgResult.data.voiceRate : 2;

    let entries: TopkaV3Entry[];
    let totalMessages: number;
    let totalVoiceMinutes: number;
    let activeUsers: number;

    if (useMockData) {
      entries = await buildMockEntries(guild, topCount, msgRate, voiceRate);
      totalMessages = entries.reduce((s, e) => s + e.messageCount, 0) + randomInt(500, 3000);
      totalVoiceMinutes = entries.reduce((s, e) => s + e.voiceMinutes, 0) + randomInt(2000, 20000);
      activeUsers = entries.length + randomInt(5, 40);
    } else {
      const lbResult = await generateCombinedLeaderboard(guildId, monthStr, topCount, msgRate, voiceRate);
      if (!lbResult.ok) {
        await interaction.editReply({ embeds: [createErrorEmbed(lbResult.message)] });
        return;
      }

      if (lbResult.data.ranked.length === 0) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              `Brak statystyk za ${monthName} ${year}. Bot musi najpierw zebrać dane, albo użyj opcji „testowe-dane".`,
            ),
          ],
        });
        return;
      }

      entries = await buildRealEntries(guild, lbResult.data.ranked);
      totalMessages = lbResult.data.totalMessages;
      totalVoiceMinutes = lbResult.data.totalVoiceMinutes;
      activeUsers = lbResult.data.activeUsers;
    }

    const card = new MonthlyTopkaCardV3({
      guildName: guild.name,
      guildIconURL: guild.iconURL({ extension: 'png', size: 128 }),
      monthName,
      year,
      totalMessages,
      totalVoiceMinutes,
      activeUsers,
      entries,
      msgRate,
      voiceRate,
    });

    const imageBuffer = await card.build();
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'topka-test-v3.png' });

    if (!postPublicly) {
      const label = useMockData
        ? `🧪 Podgląd Topki v3 (${monthName} ${year}) na **losowych danych testowych** — widoczny tylko dla Ciebie:`
        : `🧪 Podgląd testowy Topki v3 (${monthName} ${year}) — widoczny tylko dla Ciebie:`;
      await interaction.editReply({ content: label, files: [attachment] });
      logger.info(
        `[TOPKA-TEST-V3] Podgląd (${useMockData ? 'mock' : 'real'}) wygenerowany przez ${interaction.user.id} w guild=${guildId}.`,
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
      content: `# 🧪 [TEST v3] Topka — **${guild.name}**\nTo jest testowa wysyłka (grafika v3) wywołana przez ${interaction.user}.`,
      files: [attachment],
    });

    await interaction.editReply({ content: `✅ Testowa grafika Topki v3 wysłana na ${channel}.` });
    logger.info(`[TOPKA-TEST-V3] Publiczny test wysłany przez ${interaction.user.id} na #${channel.name} (guild=${guildId}).`);
  } catch (error) {
    logger.error(`[TOPKA-TEST-V3] Błąd wykonania komendy w guild=${guildId}: ${error}`);
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie udało się wygenerować testowej grafiki Topki v3. Spróbuj ponownie.')],
    });
  }
}
