const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const TwitchStreamer = require("../../models/TwitchStreamer");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("twitch")
    .setDescription("Zarządzaj listą ogłaszanych streamerów Twitcha.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription(
          "Dodaje streamerów Twitcha powiązanych z użytkownikiem Discord."
        )
        .addStringOption((option) =>
          option
            .setName("twitch-username")
            .setDescription("Nazwa użytkownika na Twitchu.")
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("discord-user")
            .setDescription("Użytkownik Discord powiązany ze streamerem.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Wyświetla listę streamerów Twitcha na tym serwerze.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Usuwa streamera Twitcha z listy.")
        .addStringOption((option) =>
          option
            .setName("twitch-username")
            .setDescription("Nazwa użytkownika na Twitchu.")
            .setRequired(true)
        )
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === "add") {
      const twitchChannel = interaction.options.getString("twitch-username");
      const discordUser = interaction.options.getUser("discord-user");
      const userId = discordUser.id;

      try {
        await interaction.deferReply();

        let streamer = await TwitchStreamer.findOne({ guildId, userId });
        if (!streamer) {
          streamer = new TwitchStreamer({
            guildId,
            twitchChannel,
            userId,
            active: true,
          });
        } else {
          streamer.twitchChannel = twitchChannel;
          streamer.active = true;
        }
        await streamer.save();

        const successEmbed = createBaseEmbed({
          description: `Streamer **${twitchChannel}** powiązany z użytkownikiem <@${userId}> został dodany lub zaktualizowany.`,
          color: "#6441A5",
        });

        await interaction.editReply({ embeds: [successEmbed] });
      } catch (error) {
        logger.error(`Błąd podczas zapisywania streamera: ${error}`);
        const errorEmbed = createBaseEmbed({
          isError: true,
          description: "Wystąpił błąd podczas zapisywania streamera.",
        });
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    } else if (subcommand === "list") {
      try {
        await interaction.deferReply();

        const streamers = await TwitchStreamer.find({ guildId, active: true });
        if (!streamers.length) {
          const notFoundEmbed = createBaseEmbed({
            isError: true,
            description: "Nie znaleziono żadnych streamerów dla tego serwera.",
          });
          await interaction.editReply({ embeds: [notFoundEmbed] });
          return;
        }

        const streamerList = streamers
          .map(
            (streamer, index) =>
              `${index + 1} - **${streamer.twitchChannel}** (Użytkownik: <@${
                streamer.userId
              }>)`
          )
          .join("\n");

        const listEmbed = createBaseEmbed({
          title: "Lista streamerów Twitcha",
          description: streamerList,
          footerText: `Znaleziono ${streamers.length} streamerów`,
          color: "#6441A5",
        });

        await interaction.editReply({ embeds: [listEmbed] });
      } catch (error) {
        logger.error(`Błąd podczas pobierania listy streamerów: ${error}`);
        const errorEmbed = createBaseEmbed({
          isError: true,
          description: "Wystąpił błąd podczas pobierania listy streamerów.",
        });
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    } else if (subcommand === "remove") {
      const twitchChannel = interaction.options.getString("twitch-username");

      try {
        await interaction.deferReply();

        const streamer = await TwitchStreamer.findOne({
          guildId,
          twitchChannel,
        });
        if (!streamer) {
          const notFoundEmbed = createBaseEmbed({
            isError: true,
            description: `Streamer **${twitchChannel}** nie został znaleziony w bazie danych.`,
          });
          return await interaction.editReply({ embeds: [notFoundEmbed] });
        }

        await TwitchStreamer.deleteOne({ guildId, twitchChannel });

        const successEmbed = createBaseEmbed({
          description: `Streamer **${twitchChannel}** został usunięty z listy.`,
          color: "#6441A5",
        });

        await interaction.editReply({ embeds: [successEmbed] });
      } catch (error) {
        logger.error(`Błąd podczas usuwania streamera: ${error}`);
        const errorEmbed = createBaseEmbed({
          isError: true,
          description: "Wystąpił błąd podczas usuwania streamera.",
        });
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }
  },
};
