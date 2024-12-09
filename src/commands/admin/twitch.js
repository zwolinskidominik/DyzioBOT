const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const TwitchStreamer = require("../../models/TwitchStreamer");

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

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#6441A5")
              .setDescription(
                `Streamer **${twitchChannel}** powiązany z użytkownikiem <@${userId}> został dodany lub zaktualizowany.`
              ),
          ],
        });
      } catch (error) {
        console.error(`Błąd podczas zapisywania streamera: ${error}`);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription("Wystąpił błąd podczas zapisywania streamera."),
          ],
        });
      }
    } else if (subcommand === "list") {
      try {
        await interaction.deferReply();

        const streamers = await TwitchStreamer.find({ guildId });

        if (!streamers.length) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription(
                  "Nie znaleziono żadnych streamerów dla tego serwera."
                ),
            ],
          });
          return;
        }

        const streamerList = streamers
          .map(
            (streamer, index) =>
              `${index + 1} - **${streamer.twitchChannel}** (Użytkownik: <@${
                streamer.userId
              }>, Aktywny: ${streamer.active ? "tak" : "nie"})`
          )
          .join("\n");

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#6441A5")
              .setTitle("Lista streamerów Twitcha")
              .setDescription(streamerList)
              .setFooter({ text: `Znaleziono ${streamers.length} streamerów` })
              .setTimestamp(),
          ],
        });
      } catch (error) {
        console.error(`Błąd podczas pobierania listy streamerów: ${error}`);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription(
                "Wystąpił błąd podczas pobierania listy streamerów."
              ),
          ],
        });
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
          return await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription(
                  `Streamer **${twitchChannel}** nie został znaleziony w bazie danych.`
                ),
            ],
          });
        }

        await TwitchStreamer.deleteOne({ guildId, twitchChannel });

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#6441A5")
              .setDescription(
                `Streamer **${twitchChannel}** został usunięty z listy.`
              ),
          ],
        });
      } catch (error) {
        console.error(`Błąd podczas usuwania streamera: ${error}`);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription("Wystąpił błąd podczas usuwania streamera."),
          ],
        });
      }
    }
  },
};
