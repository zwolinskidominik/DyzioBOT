const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const QuestionConfiguration = require('../../models/QuestionConfiguration');

const errorEmbed = new EmbedBuilder()
    .setColor('#FF0000');

const successEmbed = new EmbedBuilder()
    .setColor('#00BFFF');

module.exports = {
    run: async ({ interaction }) => {
        if (!interaction.inGuild()) {
            errorEmbed.setDescription('You can only run this command inside a server.');
            await interaction.reply({ embeds: [errorEmbed] });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.options.getChannel('channel');
        const pingRole = interaction.options.getRole('ping_role');

        if (subcommand === 'add') {
            const existingConfiguration = await QuestionConfiguration.findOne({ guildId: interaction.guildId });

            if (existingConfiguration) {
                if (existingConfiguration.questionChannelId === channel.id) {
                    errorEmbed.setDescription(`Kanał ${channel} jest już ustawiony jako kanał pytań dnia.`);
                    await interaction.reply({ embeds: [errorEmbed] });
                    return;
                }
                existingConfiguration.questionChannelId = channel.id;
                existingConfiguration.pingRoleId = pingRole ? pingRole.id : null;
                await existingConfiguration.save();

                successEmbed.setDescription(`Zaktualizowano kanał pytań dnia na ${channel}.`);
                await interaction.reply({ embeds: [successEmbed] });
                return;
            }

            const newConfiguration = new QuestionConfiguration({
                guildId: interaction.guildId,
                questionChannelId: channel.id,
                pingRoleId: pingRole ? pingRole.id : null,
            });
            await newConfiguration.save();

            successEmbed.setDescription(`Ustawiono kanał pytań dnia na ${channel}.`);
            await interaction.reply({ embeds: [successEmbed] });
            return;
        }

        if (subcommand === 'remove') {
            const configuration = await QuestionConfiguration.findOne({ guildId: interaction.guildId });

            if (!configuration) {
                errorEmbed.setDescription('Brak skonfigurowanego kanału pytań dnia.');
                await interaction.reply({ embeds: [errorEmbed] });
                return;
            }

            configuration.questionChannelId = null;
            configuration.pingRoleId = null;
            await configuration.save();

            successEmbed.setDescription('Usunięto kanał pytań dnia.');
            await interaction.reply({ embeds: [successEmbed] });
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
        .addRoleOption((option) =>
          option
            .setName('ping_role')
            .setDescription('Rola, która będzie pingowana przy dodawaniu pytania dnia.')
            .setRequired(false)
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