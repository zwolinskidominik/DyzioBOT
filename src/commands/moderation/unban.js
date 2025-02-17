const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Odbanowuje użytkownika na serwerze.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("target-user")
        .setDescription("ID użytkownika, którego chcesz odbanować.")
        .setRequired(true)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
  },

  run: async ({ interaction }) => {
    const errorEmbed = createBaseEmbed({
      isError: true,
      footerText: interaction.guild.name,
    });

    try {
      await interaction.deferReply();
      const targetUserId = interaction.options.getString("target-user");

      const bannedUsers = await interaction.guild.bans.fetch();
      const bannedUser = bannedUsers.find(
        (user) => user.user.id === targetUserId
      );

      if (!bannedUser) {
        errorEmbed.setDescription(
          "**Nie znaleziono użytkownika na liście banów.**"
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const member = bannedUser.user;
      await interaction.guild.bans.remove(targetUserId);

      const successEmbed = createBaseEmbed({
        isError: true,
        footerText: interaction.user.username,
        description: `### Odbanowano użytkownika ${member.username}`,
        thumbnail: member.displayAvatarURL({ dynamic: true }),
      }).addFields({
        name: "Moderator:",
        value: `${interaction.user}`,
        inline: true,
      });

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      logger.error(`Błąd podczas próby odbanowania użytkownika: ${error}`);
      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "**Wystąpił błąd podczas odbanowywania użytkownika.**"
          ),
        ],
      });
    }
  },
};
