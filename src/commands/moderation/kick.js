const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const checkRole = require("../../utils/checkRole");
const { removeRecentMessages } = require("../../utils/removeRecentMsgs");
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

      const targetMember = await interaction.guild.members.fetch(targetUserId);

      if (!checkRole(targetMember, interaction.member, interaction.guild.members.me)) {
        await interaction.editReply({
          embeds: [
            errorEmbed.setDescription(
              "**Nie możesz wyrzucić tego użytkownika z wyższą lub równą rolą.**"
            ),
          ],
        });
        return;
      }

      await targetMember.kick(reason);

      const successEmbed = createBaseEmbed({
        isError: false,
        footerText: interaction.user.username,
        footerIcon: interaction.user.displayAvatarURL({ dynamic: true }),
      });

      if (targetMember) {
        successEmbed.setThumbnail(
          targetMember.user.displayAvatarURL({ dynamic: true })
        );
      }

      successEmbed
        .setDescription(`### Wyrzucono użytkownika ${targetMember}`)
        .addFields(
          { name: "Moderator:", value: `${interaction.user}`, inline: true },
          { name: "Powód:", value: `${reason}`, inline: true }
        );

      await interaction.editReply({ embeds: [successEmbed] });

      removeRecentMessages(interaction.guild, targetUserId, 3600000).catch(
        (err) =>
          logger.warn(
            `Błąd przy usuwaniu wiadomości użytkownika ${targetUserId}: ${err.message}`
          )
      );
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
