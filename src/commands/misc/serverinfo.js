const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: 'serverinfo',
        description: 'Wyświetla informacje o serwerze.',
    },

    run: async ({ interaction }) => {
        if (!interaction.inGuild()) {
            interaction.reply({
                content: 'You can only run this command inside a server.',
                ephemeral: true,
            });
            return;
        }

        const { guild, user } = interaction;

        const serverInfoEmbed = new EmbedBuilder({
            author: { name: guild.name, iconURL: guild.iconURL({ size: 256 }) },

            fields: [
                { name: '❱ Właściciel', value: (await guild.fetchOwner()).user.username, inline: true },
                { name: '❱ Kanały tekstowe', value: guild.channels.cache.filter((c) => c.type === 0).toJSON().length, inline: true },
                { name: '❱ Kanały głosowe', value: guild.channels.cache.filter((c) => c.type === 2).toJSON().length, inline: true },
                { name: '❱ Data utworzenia', value: guild.createdAt.getDate(), inline: true },
                { name: '❱ Członkowie', value: guild.memberCount, inline: true },
                { name: '❱ Role', value: guild.roles.cache.size, inline: true },
            ],

            footer: { text: `Requested by @${user.username} | ${user.id}` }
        });

        interaction.reply({ embeds: [serverInfoEmbed] });
    },
};