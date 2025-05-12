import {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { IFaceitPlayer, ICS2Stats, IPlayerStats } from '../../interfaces/api/Faceit';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import { env } from '../../config';
import { getGuildConfig } from '../../config/guild';
import logger from '../../utils/logger';
import { request } from 'undici';

const { FACEIT_API_KEY } = env();

const API_BASE_URL = 'https://open.faceit.com/data/v4';

export const data = new SlashCommandBuilder()
  .setName('faceit')
  .setDescription('Wyświetla statystyki gracza z platformy Faceit.')
  .addStringOption((option) =>
    option.setName('nick').setDescription('Nick gracza na platformie Faceit').setRequired(true)
  )
  .setDMPermission(false);

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();

    const guildId = interaction.guild!.id;

    const {
      emojis: {
        faceit: { cry: CRY_EMOJI },
      },
    } = getGuildConfig(guildId);

    const nickname = interaction.options.getString('nick');
    if (!nickname) {
      await interaction.editReply('Podaj poprawny nick gracza Faceit.');
      return;
    }

    const playerData = await fetchPlayerData(nickname);
    if (!playerData) {
      await interaction.editReply(
        `${CRY_EMOJI} Nie znaleziono gracza o nicku **${nickname}**. Upewnij się, że podałeś poprawny nick.`
      );
      return;
    }

    const cs2Stats = await fetchPlayerStats(playerData.player_id);
    if (!cs2Stats) {
      await interaction.editReply(
        `${CRY_EMOJI} Nie znaleziono statystyk dla gracza **${nickname}**. Możliwe, że gracz nie rozegrał żadnych meczów w CS2.`
      );
      return;
    }

    const processedStats = processPlayerStats(playerData, cs2Stats);

    const faceitEmbed = buildFaceitEmbed(guildId, processedStats);
    const buttonRow = createProfileButtons(nickname, playerData.steam_id_64 || '0');

    await interaction.editReply({
      embeds: [faceitEmbed],
      components: [buttonRow],
    });
  } catch (error) {
    logger.error(`Błąd podczas pobierania statystyk Faceit: ${error}`);
    await interaction.editReply('Wystąpił błąd przy próbie pobrania statystyk z Faceit.');
  }
}

function getStatAsString(
  stats: Record<string, string | string[]>,
  key: string,
  defaultValue = '0'
): string {
  const v = stats[key];
  if (v === undefined) return defaultValue;
  return Array.isArray(v) ? v.join(', ') : v;
}

async function fetchPlayerData(nickname: string): Promise<IFaceitPlayer | null> {
  const apiKey = FACEIT_API_KEY;
  if (!apiKey)
    throw new Error('Brak klucza API Faceit w zmiennych środowiskowych (FACEIT_API_KEY).');

  const url = `${API_BASE_URL}/players?nickname=${encodeURIComponent(nickname)}`;
  const { statusCode, body } = await request(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (statusCode === 404) return null;
  if (statusCode !== 200) throw new Error(`Niepoprawna odpowiedź z Faceit API: ${statusCode}`);
  return (await body.json()) as IFaceitPlayer;
}

async function fetchPlayerStats(playerId: string): Promise<ICS2Stats | null> {
  const apiKey = FACEIT_API_KEY;
  if (!apiKey)
    throw new Error('Brak klucza API Faceit w zmiennych środowiskowych (FACEIT_API_KEY).');

  const url = `${API_BASE_URL}/players/${playerId}/stats/cs2`;
  const { statusCode, body } = await request(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (statusCode === 404) return null;
  if (statusCode !== 200) throw new Error(`Niepoprawna odpowiedź z Faceit API: ${statusCode}`);
  return (await body.json()) as ICS2Stats;
}

function getCountryFlag(countryCode: string): string {
  if (countryCode.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((c) => c.charCodeAt(0) + offset)
  );
}

function getFaceitLevelEmoji(guildId: string, level: number | string): string {
  const {
    emojis: {
      faceit: { levels: LEVEL_EMOJI },
    },
  } = getGuildConfig(guildId);
  const lvl = typeof level === 'string' ? parseInt(level, 10) : level;
  if (!lvl || lvl < 1 || lvl > 10) return level.toString();
  return LEVEL_EMOJI[lvl as keyof typeof LEVEL_EMOJI] ?? level.toString();
}

function processPlayerStats(playerData: IFaceitPlayer, cs2Stats: ICS2Stats): IPlayerStats {
  const flag = getCountryFlag(playerData.country);
  const avatar = playerData.avatar ?? null;
  const lifetimeStats = cs2Stats?.lifetime;

  const totalKills =
    parseInt(getStatAsString(lifetimeStats, 'Total Kills with extended stats'), 10) || 0;
  const totalMatches = parseInt(getStatAsString(lifetimeStats, 'Total Matches'), 10) || 1;

  const skillLevel =
    playerData.games?.cs2?.skill_level ?? playerData.games?.csgo?.skill_level ?? '?';

  const faceitElo = playerData.games?.cs2?.faceit_elo ?? playerData.games?.csgo?.faceit_elo ?? '?';

  const accountCreatedTimestamp = Math.floor(new Date(playerData.activated_at).getTime() / 1000);

  const matches = getStatAsString(lifetimeStats, 'Matches');
  const winRate = getStatAsString(lifetimeStats, 'Win Rate %');
  const recentResults = (lifetimeStats['Recent Results'] as string[]) || [];
  const longestWinStreak = getStatAsString(lifetimeStats, 'Longest Win Streak');

  const averageKills = (totalKills / totalMatches).toFixed(0);

  const averageHeadshots = getStatAsString(lifetimeStats, 'Average Headshots %');
  const kdRatio = getStatAsString(lifetimeStats, 'Average K/D Ratio');

  return {
    nickname: playerData.nickname,
    country: playerData.country,
    flag,
    avatar,
    skillLevel,
    faceitElo,
    accountCreatedTimestamp,
    matches,
    winRate,
    recentResults,
    longestWinStreak,
    averageKills,
    averageHeadshots,
    kdRatio,
  };
}

function formatRecentResults(guildId: string, results: string[]): string {
  if (!results.length) return 'Brak';
  const {
    emojis: {
      faceit: { checkmark: CHECK_EMOJI, crossmark: CROSS_EMOJI },
    },
  } = getGuildConfig(guildId);

  return results.map((r) => (r === '1' ? CHECK_EMOJI : CROSS_EMOJI)).join(' ');
}

function buildFaceitEmbed(guildId: string, stats: IPlayerStats): EmbedBuilder {
  const lastResultsEmoji = formatRecentResults(guildId, stats.recentResults);
  const skillLevelEmoji = getFaceitLevelEmoji(guildId, stats.skillLevel);

  return createBaseEmbed({
    title: `Profil **${stats.nickname}**`,
    description: 'Statystyki gracza z platformy Faceit.',
    thumbnail: stats.avatar || undefined,
    color: COLORS.FACEIT,
  })
    .addFields(
      { name: 'Kraj', value: `${stats.flag} ${stats.country.toUpperCase()}`, inline: true },
      { name: 'Poziom', value: skillLevelEmoji, inline: true },
      { name: 'ELO', value: stats.faceitElo.toString(), inline: true },
      { name: 'Mecze rozegrane', value: stats.matches.toString(), inline: true },
      { name: 'Procent wygranych', value: `${stats.winRate}%`, inline: true },
      { name: 'Najdłuższy winstreak', value: stats.longestWinStreak.toString(), inline: true },
      { name: 'Średnie zabójstwa', value: stats.averageKills.toString(), inline: true },
      { name: 'Headshot %', value: stats.averageHeadshots.toString(), inline: true },
      { name: 'Średnie K/D', value: stats.kdRatio.toString(), inline: true },
      { name: 'Ostatnie wyniki', value: lastResultsEmoji },
      {
        name: 'Data założenia konta',
        value: `<t:${stats.accountCreatedTimestamp}:f> (<t:${stats.accountCreatedTimestamp}:R>)`,
      }
    )
    .setFooter({
      text: 'Created by Chickenen',
      iconURL: 'https://cdn.discordapp.com/emojis/1348036200736489582.png',
    });
}

function createProfileButtons(
  nickname: string,
  steamId64: string
): ActionRowBuilder<ButtonBuilder> {
  const faceitButton = new ButtonBuilder()
    .setLabel('FACEIT')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://www.faceit.com/en/players/${encodeURIComponent(nickname)}`);

  const steamButton = new ButtonBuilder()
    .setLabel('STEAM')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://steamcommunity.com/profiles/${steamId64}`);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(faceitButton, steamButton);
}
