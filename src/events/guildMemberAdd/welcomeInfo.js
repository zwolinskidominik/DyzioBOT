const { GuildMember, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { Font } = require("canvacord");
const { GreetingsCard } = require('../../utils/GreetingsCard');
const GreetingsConfiguration = require('../../models/GreetingsConfiguration');

/**
 * 
 * @param {GuildMember} member 
 */
module.exports = async (member) => {
    try {
        const guild = member.guild;
        if (!guild) return;

        const config = await GreetingsConfiguration.findOne({ guildId: guild.id });
        if (!config || !config.greetingsChannelId) return;

        const channel = guild.channels.cache.get(config.greetingsChannelId);
        if (!channel) return;

        await Font.loadDefault();

        const avatar = member.user.displayAvatarURL({ format: 'png' });

        const card = new GreetingsCard()
            .setAvatar(avatar)
            .setDisplayName(member.user.tag)
            .setType('welcome')
            .setMessage(`Jesteś ${guild.memberCount} osóbką na serwerze!`);
        
        const image = await card.build({ format: 'png' });

        const attachment = new AttachmentBuilder(image, { name: 'welcome.png' });

        const embed = new EmbedBuilder()
            .setTitle(`Siema <@${member.user.id}>! 😎`)
            .setDescription(`Witaj na serwerze ${guild.name}! 🕹️`)
            .setImage('attachment://welcome.png')
            .setColor('#AFC362');

        await channel.send({ embeds: [embed], files: [attachment] });

    } catch (error) {
        console.log("Wystąpił błąd: ", error);
    }
}