const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { request } = require("undici");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

const faceitLevelEmojis = {
  1: "<:faceit_1lvl:1348036212728008735>",
  2: "<:faceit_2lvl:1348036221225406576>",
  3: "<:faceit_3lvl:1348036229521739879>",
  4: "<:faceit_4lvl:1348036238531362886>",
  5: "<:faceit_5lvl:1348036245347110932>",
  6: "<:faceit_6lvl:1348036252829618307>",
  7: "<:faceit_7lvl:1348036261503569930>",
  8: "<:faceit_8lvl:1348036268847665202>",
  9: "<:faceit_9lvl:1348036284706455593>",
  10: "<:faceit_10lvl:1348036292545347645>",
};

const checkmarkEmoji = "<:checkmark:1348054647117578311>";
const crossmarkEmoji = "<:crossmark:1348054636942196756>";

const data = new SlashCommandBuilder()
  .setName("faceit")
  .setDescription("Wyświetla statystyki gracza z platformy Faceit.")
  .addStringOption(option =>
    option
      .setName("nick")
      .setDescription("Nick gracza na platformie Faceit")
      .setRequired(true)
  )
  .setDMPermission(false);

async function run({ interaction }) {
  try {
    await interaction.deferReply();

    const nickname = interaction.options.getString("nick");

    const playerData = await fetchPlayerData(nickname);
    if (!playerData) {
      return interaction.editReply(`<:cry:1348444208553529364> Nie znaleziono gracza o nicku **${nickname}**. Upewnij się, że podałeś poprawny nick.`);
    }

    const cs2Stats = await fetchPlayerStats(playerData.player_id);
    if (!cs2Stats) {
      return interaction.editReply(`<:cry:1348444208553529364> Nie znaleziono statystyk dla gracza **${nickname}**. Możliwe, że gracz nie rozegrał żadnych meczów w CS2.`);
    }

    const faceitEmbed = buildFaceitEmbed(playerData, cs2Stats);

    const faceitButton = new ButtonBuilder()
      .setLabel("FACEIT")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.faceit.com/en/players/${encodeURIComponent(nickname)}`);

    const steamId64 = playerData.steam_id_64 || "0";
    const steamButton = new ButtonBuilder()
      .setLabel("STEAM")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://steamcommunity.com/profiles/${steamId64}`);

    const row = new ActionRowBuilder().addComponents(faceitButton, steamButton);

    await interaction.editReply({
      embeds: [faceitEmbed],
      components: [row],
    });

  } catch (error) {
    logger.error(`Błąd podczas pobierania statystyk Faceit: ${error}`);
    await interaction.editReply("Wystąpił błąd przy próbie pobrania statystyk z Faceit.");
  }
}

module.exports = { data, run };

async function fetchPlayerData(nickname) {
  const apiKey = process.env.FACEIT_API_KEY;
  if (!apiKey) {
    throw new Error("Brak klucza API Faceit w zmiennych środowiskowych (FACEIT_API_KEY).");
  }

  const url = `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}`;
  const { statusCode, body } = await request(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (statusCode === 404) {
    return null;
  }
  if (statusCode !== 200) {
    throw new Error(`Niepoprawna odpowiedź z Faceit API: ${statusCode}`);
  }

  const data = await body.json();
  return data;
}

async function fetchPlayerStats(playerId) {
  const apiKey = process.env.FACEIT_API_KEY;
  const url = `https://open.faceit.com/data/v4/players/${playerId}/stats/cs2`;

  const { statusCode, body } = await request(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (statusCode === 404) {
    return null;
  }
  if (statusCode !== 200) {
    throw new Error(`Niepoprawna odpowiedź z Faceit API: ${statusCode}`);
  }

  const data = await body.json();
  return data;
}

function buildFaceitEmbed(playerData, cs2Stats) {
  const nickname = playerData.nickname;
  const country = playerData.country || "N/A";
  const flag = getCountryFlag(country);
  const avatar = playerData.avatar || null;

  const skillLevelNum = playerData.games?.cs2?.skill_level 
    ?? playerData.games?.csgo?.skill_level 
    ?? "?";

  const skillLevelEmoji = getFaceitLevelEmoji(skillLevelNum);
  const faceitElo = playerData.games?.cs2?.faceit_elo 
    ?? playerData.games?.csgo?.faceit_elo 
    ?? "?";

  const accountCreated = new Date(playerData.activated_at);

  const lifetimeStats = cs2Stats?.lifetime || {};
  const matches = lifetimeStats["Matches"] || "0";
  const winRate = lifetimeStats["Win Rate %"] || "0";
  const recentResults = lifetimeStats["Recent Results"] || [];
  const longestWinStreak = lifetimeStats["Longest Win Streak"] || "0";
  const totalKills = parseInt(lifetimeStats["Total Kills with extended stats"], 10) || 0;
  const totalMatches = parseInt(lifetimeStats["Total Matches"], 10) || 1;
  const averageKills = (totalKills / totalMatches).toFixed(0);
  const averageHeadshots = lifetimeStats["Average Headshots %"] || "0";
  const kdRatio = lifetimeStats["Average K/D Ratio"] || "0";
  const lastResultsEmoji = recentResults.map(r => (r === "1" ? checkmarkEmoji : crossmarkEmoji)).join(" ");

  const embed = createBaseEmbed({
    title: `Profil **${nickname}**`,
    description: "Statystyki gracza z platformy Faceit.",
    thumbnail: avatar || undefined,
    color: "#FF5500",
  })
    .addFields(
      { name: "Kraj", value: `${flag} ${country.toUpperCase()}`, inline: true },
      { name: "Poziom", value: skillLevelEmoji, inline: true },
      { name: "ELO", value: faceitElo.toString(), inline: true },
      { name: "Mecze rozegrane", value: matches.toString(), inline: true },
      { name: "Procent wygranych", value: `${winRate}%`, inline: true },
      { name: "Najdłuższy winstreak", value: longestWinStreak.toString(), inline: true },
      { name: "Średnie zabójstwa", value: averageKills.toString(), inline: true },
      { name: "Headshot %", value: averageHeadshots.toString(), inline: true },
      { name: "Średnie K/D", value: kdRatio.toString(), inline: true },
      { name: "Ostatnie wyniki", value: lastResultsEmoji || "Brak" },
      {
        name: "Data założenia konta",
        value: `<t:${Math.floor(accountCreated.getTime() / 1000)}:f> (<t:${Math.floor(accountCreated.getTime() / 1000)}:R>)`,
      },
    )
    .setFooter({
      text: "Created by Chickenen",
      iconURL: "https://cdn.discordapp.com/emojis/1348036200736489582.png"
    });

  return embed;
}

function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "";
  const code = countryCode.toUpperCase();
  const offset = 127397;
  return String.fromCodePoint(...[...code].map(c => c.charCodeAt(0) + offset));
}

function getFaceitLevelEmoji(level) {
  const lvl = parseInt(level, 10);
  if (!lvl || lvl < 1 || lvl > 10) return level.toString();
  return faceitLevelEmojis[lvl] ?? level.toString();
}
