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
    try {
      const targetUserId = interaction.options.get('target-user').value;
      const reason = interaction.options.get('reason')?.value || 'Brak';

      await interaction.deferReply();

      const targetUser = await interaction.guild.members.fetch(targetUserId);

      if (!targetUser) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('**Taki użytkownik nie istnieje na tym serwerze.**')
          .setTimestamp()
          .setFooter({ text: interaction.guild.name });

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      if (targetUser.id === interaction.guild.ownerId) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('**Nie możesz zbanować tego użytkownika, ponieważ jest on właścicielem serwera.**')
          .setTimestamp()
          .setFooter({ text: interaction.guild.name });

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const targetUserRolePosition = targetUser.roles.highest.position;
      const requestUserRolePosition = interaction.member.roles.highest.position;
      const botRolePosition = interaction.guild.members.me.roles.highest.position;

      if (targetUserRolePosition >= requestUserRolePosition) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription("**Nie możesz zbanować użytkownika, ponieważ ma taką samą lub wyższą rolę.**")
          .setTimestamp()
          .setFooter({ text: interaction.guild.name });

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      if (targetUserRolePosition >= botRolePosition) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription("**Nie mogę zbanować tego użytkownika, ponieważ ma taką samą lub wyższą rolę ode mnie.**")
          .setTimestamp()
          .setFooter({ text: interaction.guild.name });

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      await targetUser.ban({ reason });

      const successEmbed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setDescription(`**Użytkownik ${targetUser} został zbanowany.**`)
        .addFields(
          { name: 'Moderator:', value: `${interaction.user}`, inline: true },
          { name: 'Powód:', value: `${reason}`, inline: true }
        )
        .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(`Wystąpił błąd podczas banowania: ${error}`);

      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('**Wystąpił błąd podczas banowania.**')
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
