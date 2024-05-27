const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const GuildConfiguration = require('../../models/GuildConfiguration');

const errorEmbed = new EmbedBuilder()
    .setColor('#FF0000');

const successEmbed = new EmbedBuilder()
    .setColor('#00BFFF');

module.exports = {
  run: async ({ interaction }) => {
    let guildConfiguration = await GuildConfiguration.findOne({ guildId: interaction.guildId });

    if (!guildConfiguration) {
        guildConfiguration = new GuildConfiguration({ guildId: interaction.guildId });
    };

    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');

    if (subcommand === 'add') {
        if (guildConfiguration.suggestionChannelIds.includes(channel.id)) {
          errorEmbed.setDescription(`${channel} jest już kanałem sugestii.`);
          await interaction.reply({ embeds: [errorEmbed] });
          return;
        }

        guildConfiguration.suggestionChannelIds.push(channel.id);
        await guildConfiguration.save();

        successEmbed.setDescription(`Dodano ${channel} do kanałów sugestii.`);
        await interaction.reply({ embeds: [successEmbed] });
        return;
    }

    if (subcommand === 'remove') {
        if (!guildConfiguration.suggestionChannelIds.includes(channel.id)) {
          errorEmbed.setDescription(`${channel} nie jest kanałem sugestii.`);
          await interaction.reply({ embeds: [errorEmbed] });
          return;
        };

        guildConfiguration.suggestionChannelIds = guildConfiguration.suggestionChannelIds.filter(
            (id) => id !== channel.id
        );
        await guildConfiguration.save();

        successEmbed.setDescription(`Usunięto ${channel} z kanałów sugestii.`);
        await interaction.reply({ embeds: [successEmbed] });
        return;
    }
  },

  options: {
    userPermissions: ['Administrator']
  },

  data: new SlashCommandBuilder()
    .setName('config-suggestions')
    .setDescription('Configure suggestions.')
    .setDMPermission(false)
    .addSubcommand((subcommand) => 
      subcommand
        .setName('add')
        .setDescription('Dodaje kanał sugestii.')
        .addChannelOption((option) => 
          option
            .setName('channel')
            .setDescription('Kanał, który chcesz dodać.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) => 
      subcommand
        .setName('remove')
        .setDescription('Usuwa kanał sugestii.')
        .addChannelOption((option) => 
          option
            .setName('channel')
            .setDescription('Kanał, który chcesz usunąć.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
};