const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const TwitchStreamer = require('../../models/TwitchStreamer');

module.exports = {
  data: {
    name: 'twitch-add',
    description: 'Dodaje streamera Twitcha do listy ogłaszanych streamów.',
    options: [
      {
        name: 'twitch-username',
        description: 'Nazwa użytkownika na Twitchu.',
        required: true,
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

  run: async ({ interaction }) => {
    const twitchChannel = interaction.options.get('twitch-username').value;

    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply();

      let streamer = await TwitchStreamer.findOne({ guildId, twitchChannel });

      if (!streamer) {
        streamer = new TwitchStreamer({ guildId, twitchChannel });
      }

      await streamer.save();

      const successEmbed = new EmbedBuilder()
        .setColor('#6441A5')
        .setDescription(`Streamer ${twitchChannel} został dodany do listy ogłaszanych streamów.`);
      
        await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Błąd podczas zapisywania streamera: ${error}`);

      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('Wystąpił błąd podczas zapisywania streamera.');

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
