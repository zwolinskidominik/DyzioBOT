const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banuje użytkownika na serwerze.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("target-user")
        .setDescription("Użytkownik, którego chcesz zbanować.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Powód zbanowania.")
        .setRequired(true)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
  },

  run: async ({ interaction }) => {
    const errorEmbed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTimestamp()
      .setFooter({ text: interaction.guild.name });

    try {
      const targetUserId = interaction.options.getUser("target-user").id;
      const reason = interaction.options.getString("reason") || "Brak";
      await interaction.deferReply();
      const targetUser = await interaction.guild.members.fetch(targetUserId);

      const successEmbed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
        .setFooter({
          text: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();

      if (!targetUser) {
        await interaction.editReply({
          embeds: [
            errorEmbed.setDescription(
              "**Taki użytkownik nie istnieje na tym serwerze.**"
            ),
          ],
        });
        return;
      }

      const targetUserRolePosition = targetUser.roles.highest.position;
      const requestUserRolePosition = interaction.member.roles.highest.position;
      const botRolePosition =
        interaction.guild.members.me.roles.highest.position;

      if (
        targetUser.id === interaction.guild.ownerId ||
        targetUserRolePosition >= requestUserRolePosition ||
        targetUserRolePosition >= botRolePosition
      ) {
        await interaction.editReply({
          embeds: [
            errorEmbed.setDescription(
              "**Nie możesz zbanować tego użytkownika z wyższą lub równą rolą.**"
            ),
          ],
        });
        return;
      }

      await targetUser.ban({ reason });

      await interaction.editReply({
        embeds: [
          successEmbed
            .setDescription(`**Użytkownik ${targetUser} został zbanowany.**`)
            .addFields(
              {
                name: "Moderator:",
                value: `${interaction.user}`,
                inline: true,
              },
              { name: "Powód:", value: `${reason}`, inline: true }
            ),
        ],
      });
    } catch (error) {
      console.error(`Wystąpił błąd podczas banowania: ${error}`);

      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription("**Wystąpił błąd podczas banowania.**"),
        ],
      });
    }
  },
};
