const { SlashCommandBuilder, ChannelType } = require('discord.js');
const QuestionConfiguration = require('../../models/QuestionConfiguration');

module.exports = {
    run: async ({ interaction }) => {
        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.options.getChannel('channel');

        if (subcommand === 'add') {
            const existingConfiguration = await QuestionConfiguration.findOne({ guildId: interaction.guildId });

            if (existingConfiguration) {
                if (existingConfiguration.questionChannelId === channel.id) {
                    await interaction.reply(`Kanał ${channel} jest już ustawiony jako kanał pytań dnia.`);
                    return;
                }
                existingConfiguration.questionChannelId = channel.id;
                await existingConfiguration.save();
                await interaction.reply(`Zaktualizowano kanał pytań dnia na ${channel}.`);
                return;
            }

            const newConfiguration = new QuestionConfiguration({
                guildId: interaction.guildId,
                questionChannelId: channel.id,
            });
            await newConfiguration.save();
            await interaction.reply(`Ustawiono kanał pytań dnia na ${channel}.`);
            return;
        }

        if (subcommand === 'remove') {
            const configuration = await QuestionConfiguration.findOne({ guildId: interaction.guildId });

            if (!configuration) {
                await interaction.reply(`Brak skonfigurowanego kanału pytań dnia.`);
                return;
            }

            configuration.questionChannelId = null;
            await configuration.save();
            await interaction.reply(`Usunięto kanał pytań dnia.`);
            return;
        }
    },
    
    options: {
        userPermissions: ['Administrator'],
    },

    data: new SlashCommandBuilder()
    .setName('config-questions')
    .setDescription('Skonfiguruj pytania.')
    .setDMPermission(false)
    .addSubcommand((subcommand) => 
      subcommand
        .setName('add')
        .setDescription('Dodaje kanał dla pytań dnia.')
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
        .setDescription('Usuwa kanał dla pytań dnia.')
        .addChannelOption((option) => 
          option
            .setName('channel')
            .setDescription('Kanał, który chcesz usunąć.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),
}