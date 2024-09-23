const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const TwitchStreamer = require("../../models/TwitchStreamer");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("twitch-list")
    .setDescription(
      "Wyświetla listę streamerów Twitcha, którzy są ogłaszani na tym serwerze."
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  run: async ({ interaction }) => {
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply();

      const streamers = await TwitchStreamer.find({ guildId });

      if (!streamers.length) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#FF0000")
              .setDescription(
                "Nie znaleziono żadnych dodanych streamerów Twitcha dla tego serwera."
              ),
          ],
        });
        return;
      }

      const streamerList = streamers
        .map(
          (streamer, index) => `${index + 1} - **${streamer.twitchChannel}**`
        )
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor("#6441A5")
        .setTitle("Lista ogłaszanych streamerów Twitcha")
        .setDescription(streamerList)
        .setFooter({ text: `Znaleziono ${streamers.length} streamerów` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
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
  },
};
