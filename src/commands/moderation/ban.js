const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'ban',
    description: 'Banuje użytkownika na serwerze.',
    options: [
      {
        name: 'target-user',
        description: 'Użytkownik, którego chcesz zbanować.',
        required: true,
        type: ApplicationCommandOptionType.Mentionable,
      },
      {
        name: 'reason',
        description: 'Powód zbanowania.',
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

  run: async ({ interaction }) => {
    const targetUserId = interaction.options.get('target-user').value;
    const reason = interaction.options.get('reason')?.value || 'Brak';

    await interaction.deferReply();

    const targetUser = await interaction.guild.members.fetch(targetUserId);

    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTimestamp()
      .setFooter({ text: interaction.guild.name });

    if (!targetUser) {
      errorEmbed.setDescription('**Taki użytkownik nie istnieje na tym serwerze.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (targetUser.id === interaction.guild.ownerId) {
      errorEmbed.setDescription('**Nie możesz zbanować tego użytkownika, ponieważ jest on właścicielem serwera.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const targetUserRolePosition = targetUser.roles.highest.position; //Highest role of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; //Highest role of the user running the cmd
    const botRolePosition = interaction.guild.members.me.roles.highest.position; //Highest role of the bot

    if (targetUserRolePosition >= requestUserRolePosition) {
      errorEmbed.setDescription("**Nie możesz zbanować użytkownika, ponieważ ma taką samą lub wyższą rolę.**");

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (targetUserRolePosition >= botRolePosition) {
      errorEmbed.setDescription("**Nie mogę zbanować tego użytkownika, ponieważ ma taką samą lub wyższą rolę ode mnie.**");

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Ban the target user
    try {
      await targetUser.ban({ reason });

      errorEmbed
        .setDescription(`**Użytkownik ${targetUser} został zbanowany.**`)
        .addFields(
          { name: 'Moderator:', value: `${interaction.user}`, inline: true },
          { name: 'Powód:', value: `${reason}`, inline: true }
        )
        .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (error) {
      console.log(`Wystąpił błąd podczas banowania: ${error}`);

      errorEmbed.setDescription('**Wystąpił błąd podczas banowania.**');

      interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
  },

  options: {
    permissionsRequired: ['BanMembers'],
    botPermissions: ['BanMembers'],
  },
};
