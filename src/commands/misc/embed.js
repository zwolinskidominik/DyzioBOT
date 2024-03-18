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
        const title = interaction.options.get('title').value;
        const description = interaction.options.get('description').value;
        const color = interaction.options.get('color')?.value || '#000000';
        const title2 = interaction.options.get('title2')?.value || ' ';
        const description2 = interaction.options.get('description2')?.value || ' ';
        const title3 = interaction.options.get('title3')?.value || ' ';
        const description3 = interaction.options.get('description3')?.value || ' ';
        try {
            const embed = new EmbedBuilder()
                .setTitle(`${title}`)
                .setDescription(`${description}`)
                .setThumbnail(interaction.user.avatarURL())
                .addFields(
                { name: '\u200B', value: ' '},
                { name: `${title2}`, value: `${description2}`, inline: true },
                { name: `${title3}`, value: `${description3}`, inline: true })
                .setColor(`${color}`)
                .setTimestamp()
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

            interaction.deferReply();
            interaction.deleteReply();
            interaction.channel.send({ embeds: [embed] });
        } catch (error) {
            console.log(error);
        }
    },

    options: {
        devOnly: false,
        userPermissions: ['Administrator'],
        botPermissions: ['Administrator'],
        deleted: true,
    },
};