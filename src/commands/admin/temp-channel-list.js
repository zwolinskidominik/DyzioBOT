const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const TempChannelConfiguration = require("../../models/TempChannelConfiguration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("temp-channel-list")
    .setDescription("Wyświetla listę kanałów, które są monitorowane."),

  run: async ({ interaction }) => {
    try {
      const configs = await TempChannelConfiguration.find({
        guildId: interaction.guild.id,
      });

      if (configs.length === 0) {
        return interaction.reply({
          content: "Brak monitorowanych kanałów.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("Monitorowane kanały")
        .setColor("#00BFFF");

      configs.forEach((config) => {
        const channel = interaction.guild.channels.cache.get(config.channelId);
        embed.addFields({
          name: "Kanał:",
          value: channel ? channel.name : `ID: ${config.channelId}`,
          inline: true,
        });
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error(`Błąd przy wyświetlaniu listy kanałów: ${error}`);
      return interaction.reply({
        content: "Wystąpił błąd podczas wyświetlania listy kanałów.",
        ephemeral: true,
      });
    }
  },
};
