const { SlashCommandBuilder, ChannelType, ChatInputCommandInteraction } = require('discord.js');
const GuildConfiguration = require('../../models/GuildConfiguration');

module.exports = {
  /**
   * 
   * @param {Object} param0 
   * @param {ChatInputCommandInteraction} param0.interaction
   */
  
  run: async ({ interaction }) => {
    let guildConfiguration = await GuildConfiguration.findOne({ guildId: interaction.guildId });

    if (!guildConfiguration) {
        guildConfiguration = new GuildConfiguration({ guildId: interaction.guildId });
    };

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
        const channel = interaction.options.getChannel('channel');

        if (guildConfiguration.suggestionChannelIds.includes(channel.id)) {
            await interaction.reply(`${channel} jest już kanałem sugestii.`);
            return;
        }

        guildConfiguration.suggestionChannelIds.push(channel.id);
        await guildConfiguration.save();

        await interaction.reply(`Dodano ${channel} do kanałów sugestii.`);
        return;
    }

    if (subcommand === 'remove') {
        const channel = interaction.options.getChannel('channel');

        if (!guildConfiguration.suggestionChannelIds.includes(channel.id)) {
            await interaction.reply(`${channel} is not a suggestion channel.`);
            return;
        };

        guildConfiguration.suggestionChannelIds = guildConfiguration.suggestionChannelIds.filter(
            (id) => id !== channel.id
        );
        await guildConfiguration.save();

        await interaction.reply(`Usunięto ${channel} z kanałów sugestii.`);
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