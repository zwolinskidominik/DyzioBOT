const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const GreetingsConfiguration = require('../../models/GreetingsConfiguration');

module.exports = {
  data: {
    name: 'config-greetings',
    description: 'Ustawia kanał powitań dla serwera.',
    options: [
      {
        name: 'channel',
        description: 'Kanał, który chcesz ustawić jako kanał powitań.',
        required: true,
        type: ApplicationCommandOptionType.Channel,
      },
    ],
  },

  run: async ({ interaction }) => {
    const guildId = interaction.guild.id;
    const greetingsChannelId = interaction.options.get('channel').value;

    try {
      await interaction.deferReply();

      let greetingsConfig = await GreetingsConfiguration.findOne({ guildId });

      if (greetingsConfig) {
        greetingsConfig.greetingsChannelId = greetingsChannelId;
      } else {
        greetingsConfig = new GreetingsConfiguration({ guildId, greetingsChannelId });
      }

      await greetingsConfig.save();

      const successEmbed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setDescription(`Kanał powitań został ustawiony na <#${greetingsChannelId}>.`);
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
