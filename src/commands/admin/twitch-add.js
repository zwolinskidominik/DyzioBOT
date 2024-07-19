const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const TwitchStreamer = require("../../models/TwitchStreamer");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("twitch-add")
    .setDescription("Dodaje streamera Twitcha do listy ogłaszanych streamów.")
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

      let streamer = await TwitchStreamer.findOne({ guildId, twitchChannel });

      if (!streamer) {
        streamer = new TwitchStreamer({ guildId, twitchChannel });
      }

      await streamer.save();

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#6441A5")
            .setDescription(
              `Streamer **${twitchChannel}** został dodany do listy ogłaszanych streamów.`
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
  },
};
