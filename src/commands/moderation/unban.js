const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

const errorEmbed = new EmbedBuilder()
  .setColor('#FF0000')
  .setTimestamp()
  .setFooter({ text: interaction.guild.name });

module.exports = {
  data: {
    name: 'unban',
    description: 'Odbanowuje użytkownika na serwerze.',
    options: [{
      name: 'target-user',
      description: 'Użytkownik, którego chcesz odbanować.',
      required: true,
      type: ApplicationCommandOptionType.String,
    }, ],
  },
  run: async ({ interaction }) => {
    const targetUserId = interaction.options.get('target-user').value;

    await interaction.deferReply();

    const bannedUsers = await interaction.guild.bans.fetch();
    let bannedId = bannedUsers.find((user) => user.user.id === targetUserId);

    if (!bannedId) {
      errorEmbed.setDescription('**Nie znaleziono użytkownika na liście banów.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const targetUser = bannedId.user.username;

    // Unban the target user
    try {
      await interaction.guild.bans.remove(targetUserId);

      successEmbed
        .setColor('#00BFFF')
        .setDescription(`Użytkownik **${targetUser}** został odbanowany`)
        .addFields(
          { name: 'Moderator:', value: `${interaction.user}`, inline: true },
          { name: 'Powód:', value: `${reason}`, inline: true }
        )
        .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
      console.log(`Wystąpił błąd podczas próby odbanowania: ${error}`);

      errorEmbed.setDescription('**Wystąpił błąd podczas odbanowywania użytkownika.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
  },

  options: {
    permissionsRequired: ['BanMembers'],
    botPermissions: ['BanMembers'],
  },
};