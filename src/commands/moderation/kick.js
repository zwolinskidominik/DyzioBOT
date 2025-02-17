const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Wyrzuca użytkownika z serwera.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("target-user")
        .setDescription("Użytkownik, którego chcesz wyrzucić.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Powód wyrzucenia.")
        .setRequired(true)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.KickMembers],
    botPermissions: [PermissionFlagsBits.KickMembers],
  },

  run: async ({ interaction }) => {
    const errorEmbed = createBaseEmbed({
      isError: true,
      footerText: interaction.guild.name,
    });

    try {
      await interaction.deferReply();
      const targetUserId = interaction.options.getUser("target-user").id;
      const reason = interaction.options.getString("reason") || "Brak";

      const targetUser = await interaction.guild.members.fetch(targetUserId);

      const successEmbed = createBaseEmbed({
        isError: true,
        footerText: interaction.user.username,
        footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
      });
      if (targetUser) {
        successEmbed.setThumbnail(
          targetUser.user.displayAvatarURL({ dynamic: true })
        );
      }

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
              "**Nie możesz wyrzucić tego użytkownika z wyższą lub równą rolą.**"
            ),
          ],
        });
        return;
      }

      await targetUser.kick(reason);

      successEmbed
        .setDescription(`### Wyrzucono użytkownika ${targetUser}`)
        .addFields(
          {
            name: "Moderator:",
            value: `${interaction.user}`,
            inline: true,
          },
          { name: "Powód:", value: `${reason}`, inline: true }
        );

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      logger.error(`Błąd podczas wyrzucenia użytkownika: ${error}`);
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "**Wystąpił błąd podczas próby wyrzucenia użytkownika.**"
          ),
        ],
      });
    }
  },
};
