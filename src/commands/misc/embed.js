const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: 'embed',
        description: 'Create an embed',
        options: [
            {
                name: 'title',
                type: ApplicationCommandOptionType.String,
                description: 'Tytuł embeda',
                required: true,
            },
            {
                name: 'description',
                type: ApplicationCommandOptionType.String,
                description: 'Opis embeda',
                required: true,
            },
            {
                name: 'color',
                type: ApplicationCommandOptionType.String,
                description: 'Kolor embeda w formacie HEX (#000000)',
                required: false,
            },
            {
                name: 'title2',
                type: ApplicationCommandOptionType.String,
                description: 'Tytuł drugiego pola',
                required: false,
            },
            {
                name: 'description2',
                type: ApplicationCommandOptionType.String,
                description: 'Opis drugiego pola',
                required: false,
            },
            {
                name: 'title3',
                type: ApplicationCommandOptionType.String,
                description: 'Tytuł trzeciego pola',
                required: false,
            },
            {
                name: 'description3',
                type: ApplicationCommandOptionType.String,
                description: 'Opis trzeciego pola',
                required: false,
            },
        ],
    },
    run: async ({ interaction }) => {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const color = interaction.options.getString('color') || '#000000';
        const title2 = interaction.options.getString('title2') || null;
        const description2 = interaction.options.getString('description2') || null;
        const title3 = interaction.options.getString('title3') || null;
        const description3 = interaction.options.getString('description3') || null;

        try {
            await interaction.deferReply({ ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setThumbnail(interaction.user.avatarURL())
                .setColor(color)
                .setTimestamp()
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

            // Conditionally add fields only if provided
            if (title2 && description2) {
                embed.addFields({ name: title2, value: description2, inline: true });
            }
            if (title3 && description3) {
                embed.addFields({ name: title3, value: description3, inline: true });
            }

            await interaction.editReply({ content: 'Embed został utworzony.', ephemeral: true });
            await interaction.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Wystąpił błąd podczas tworzenia embeda.', ephemeral: true });
        }
    },

    options: {
        devOnly: false,
        userPermissions: ['Administrator'],
        botPermissions: ['Administrator'],
        deleted: false,
    },
};
