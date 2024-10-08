const { SlashCommandBuilder, ChannelType } = require("discord.js");
const TempChannelConfiguration = require("../../models/TempChannelConfiguration");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("temp-channel-add")
    .setDescription("Dodaje kanał do nasłuchiwania.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Kanał głosowy, który chcesz dodać do nasłuchiwania.")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    ),

  run: async ({ interaction }) => {
    const channel = interaction.options.getChannel("channel");
    const guildId = interaction.guild.id;

    try {
      const existingConfig = await TempChannelConfiguration.findOne({
        guildId,
        channelId: channel.id,
      });

      if (existingConfig) {
        return interaction.reply({
          content: "Ten kanał jest już dodany do nasłuchiwania.",
          ephemeral: true,
        });
      }

      const newConfig = new TempChannelConfiguration({
        guildId,
        channelId: channel.id,
      });

      await newConfig.save();
      return interaction.reply({
        content: `Kanał ${channel.name} został dodany do nasłuchiwania.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error(`Błąd przy dodawaniu kanału do nasłuchiwania: ${error}`);
      return interaction.reply({
        content: "Wystąpił błąd podczas dodawania kanału.",
        ephemeral: true,
      });
    }
  },
};
