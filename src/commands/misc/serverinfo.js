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

        const { guild } = interaction;
        const { members } = guild;
        const { name, ownerId, createdTimestamp, memberCount } = guild;
        const icon = guild.iconURL();
        const roles = guild.roles.cache.size;
        const emojis = guild.emojis.cache.size;
        const id = guild.id;
        const joinedAt = interaction.member.joinedAt;
 
        let baseVerification = guild.verificationLevel;
 
        if (baseVerification == 0) baseVerification = 'Żaden';
        if (baseVerification == 1) baseVerification = 'Niski';
        if (baseVerification == 2) baseVerification = 'Średni';
        if (baseVerification == 3) baseVerification = 'Wysoki';
        if (baseVerification == 4) baseVerification = 'Bardzo wysoki';
 
        const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setThumbnail(icon)
        .setFooter({ text: `Server ID: ${id}`, iconURL: icon})
        .setTimestamp()
        .addFields({ name: 'Nazwa', value: `${name}`, inline: false})
        .addFields({ name: 'Właściciel', value: `<@${ownerId}>`, inline: true})
        .addFields({ name: 'Data utworzenia', value: `<t:${parseInt(guild.createdTimestamp / 1000)}:R>`, inline: true})
        .addFields({ name: 'Dołączono', value: `<t:${parseInt(joinedAt / 1000)}:R>`, inline: true})
        .addFields({ name: 'Członkowie', value: `${memberCount}`, inline: true})
        .addFields({ name: 'Role', value: `${roles}`, inline: true})
        .addFields({ name: 'Emoji', value: `${emojis}`, inline: true})
        .addFields({ name: 'Stopień weryfikacji', value: `${baseVerification}`, inline: true})
        .addFields({ name: 'Boosty', value: `${guild.premiumSubscriptionCount}`, inline: true});
 
        await interaction.reply({ embeds: [embed] });
    },
};