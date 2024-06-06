const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'unban',
    description: 'Odbanowuje użytkownika na serwerze.',
    options: [{
      name: 'target-user',
      description: 'Użytkownik, którego chcesz odbanować.',
      required: true,
      type: ApplicationCommandOptionType.String,
    }],
  },
  run: async ({ interaction }) => {
    try {
      const targetUserId = interaction.options.get('target-user').value;

      await interaction.deferReply();

      const bannedUsers = await interaction.guild.bans.fetch();
      const bannedUser = bannedUsers.find((user) => user.user.id === targetUserId);

      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      if (!bannedUser) {
        errorEmbed.setDescription('**Nie znaleziono użytkownika na liście banów.**');
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const member = bannedUser.user;

      // Unban the target user
      await interaction.guild.bans.remove(targetUserId);

      const successEmbed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setDescription(`**Użytkownik ${member.username} został odbanowany**`)
        .addFields(
          { name: 'Moderator:', value: `${interaction.user}`, inline: true }
        )
        .setThumbnail(member.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
      console.log(`Wystąpił błąd podczas próby odbanowania: ${error}`);

      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('**Wystąpił błąd podczas odbanowywania użytkownika.**')
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },

  options: {
    permissionsRequired: ['BanMembers'],
    botPermissions: ['BanMembers'],
  },
};
