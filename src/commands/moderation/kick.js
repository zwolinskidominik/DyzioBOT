const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'kick',
    description: 'Wyrzuca użytkownika z serwera.',
    options: [
      {
        name: 'target-user',
        description: 'Użytkownik, którego chcesz wyrzucić.',
        required: true,
        type: ApplicationCommandOptionType.Mentionable,
      },
      {
        name: 'reason',
        description: 'Powód wyrzucenia.',
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

  run: async ({ interaction }) => {
    const targetUserId = interaction.options.get('target-user').value;
    const reason = interaction.options.get('reason')?.value || 'Brak';

    await interaction.deferReply();

    const targetUser = await interaction.guild.members.fetch(targetUserId);

    if (!targetUser) {
      errorEmbed.setDescription('**Taki użytkownik nie istnieje na tym serwerze.**');
      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (targetUser.id === interaction.guild.ownerId) {
      errorEmbed.setDescription('**Nie możesz wyrzucić tego użytkownika, ponieważ jest on właścicielem serwera.**');
      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const targetUserRolePosition = targetUser.roles.highest.position; //Highest role of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; //Highest role of the user running the cmd
    const botRolePosition = interaction.guild.members.me.roles.highest.position; //Highest role of the bot

    if (targetUserRolePosition >= requestUserRolePosition) {
      errorEmbed.setDescription("**Nie możesz wyrzucić użytkownika, ponieważ ma taką samą lub wyższą rolę.**");
      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (targetUserRolePosition >= botRolePosition) {
      errorEmbed.setDescription("**Nie mogę wyrzucić tego użytkownika, ponieważ ma taką samą lub wyższą rolę ode mnie.**");
      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTimestamp()
      .setFooter({ text: interaction.guild.name });
    // Kick the target user
    try {
      await targetUser.kick(reason);

      errorEmbed
        .setDescription(`**Użytkownik ${targetUser} został wyrzucony.**`)
        .addFields(
          { name: 'Moderator:', value: `${interaction.user}`, inline: true },
          { name: 'Powód:', value: `${reason}`, inline: true }
        )
        .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (error) {
      console.log(`Wystąpił błąd podczas wyrzucenia: ${error}`);

      errorEmbed.setDescription('**Wystąpił błąd podczas próby wyrzucenia użytkownika.**');
      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
  },

  options: {
    permissionsRequired: ['KickMembers'],
    botPermissions: ['KickMembers'],
  },
};
