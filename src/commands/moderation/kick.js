const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

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
    try {
      const targetUserId = interaction.options.getUser("target-user").id;
      const reason = interaction.options.getString("reason") || "Brak";

      await interaction.deferReply();

      const targetUser = await interaction.guild.members.fetch(targetUserId);

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

      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      const successEmbed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
        .setFooter({
          text: `${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();

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

      await interaction.editReply({
        embeds: [
          successEmbed
            .setDescription(`**Użytkownik ${targetUser} został wyrzucony.**`)
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
      console.log(`Wystąpił błąd podczas wyrzucenia: ${error}`);

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
