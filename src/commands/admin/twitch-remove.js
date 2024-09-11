const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const TwitchStreamer = require("../../models/TwitchStreamer");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("twitch-remove")
    .setDescription("Usuwa streamera Twitcha z listy ogłaszanych streamów.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("twitch-username")
        .setDescription("Nazwa użytkownika na Twitchu.")
        .setRequired(true)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const twitchChannel = interaction.options.getString("twitch-username");
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply();

      const streamer = await TwitchStreamer.findOne({ guildId, twitchChannel });

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
              `Streamer **${twitchChannel}** został usunięty z listy ogłaszanych streamów.`
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
  },
};
