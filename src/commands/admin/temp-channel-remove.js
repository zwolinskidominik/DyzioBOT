const { SlashCommandBuilder, ChannelType } = require("discord.js");
const TempChannelConfiguration = require("../../models/TempChannelConfiguration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("temp-channel-remove")
    .setDescription("Usuwa kanał głosowy z monitorowanych.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Kanał głosowy, który chcesz usunąć z nasłuchiwania.")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    ),

  run: async ({ interaction }) => {
    const channel = interaction.options.getChannel("channel");
    const guildId = interaction.guild.id;

    try {
      const existingConfig = await TempChannelConfiguration.findOneAndDelete({
        guildId,
        channelId: channel.id,
      });

      if (!existingConfig) {
        return interaction.reply({
          content: "Ten kanał nie był monitorowany.",
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `Kanał ${channel.name} został usunięty z nasłuchiwania.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error(`Błąd przy usuwaniu kanału z nasłuchiwania: ${error}`);
      return interaction.reply({
        content: "Wystąpił błąd podczas usuwania kanału.",
        ephemeral: true,
      });
    }
  },
};
