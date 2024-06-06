const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const StreamChannel = require('../../models/StreamConfiguration');

module.exports = {
  data: {
    name: 'config-twitch',
    description: 'Ustawia kanał Discorda do ogłaszania streamów Twitcha.',
    options: [
      {
        name: 'channel',
        description: 'Kanał Discorda do ogłaszania streamów z Twitcha.',
        required: true,
        type: ApplicationCommandOptionType.Channel,
      },
    ],
  },

  run: async ({ interaction }) => {
    const guildId = interaction.guild.id;
    const channelId = interaction.options.get('channel').value;

    try {
      await interaction.deferReply();

      let streamChannel = await StreamChannel.findOne({ guildId });

      if (streamChannel) {
        streamChannel.channelId = channelId;
      } else {
        streamChannel = new StreamChannel({ guildId, channelId });
      }

      await streamChannel.save();

      const successEmbed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setDescription(`Kanał <#${channelId}> z powiadomieniami o streamkach z Twitcha został ustawiony.`);
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Błąd podczas zapisywania konfiguracji kanału: ${error}`);

      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('Wystąpił błąd podczas zapisywania konfiguracji kanału.');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
