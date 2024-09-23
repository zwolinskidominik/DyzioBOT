const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const ms = require("ms");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Wysyła użytkownika na wakacje od serwera.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("target-user")
        .setDescription("Użytkownik, którego chcesz wyciszyć.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("Czas trwania wyciszenia (30min, 1h, 1 dzień).")
        .setRequired(true)
        .addChoices(
          { name: "15 min", value: "15 min" },
          { name: "30 min", value: "30 min" },
          { name: "1 godz.", value: "1 hour" },
          { name: "1 dzień", value: "1 day" },
          { name: "1 tydzień", value: "1 week" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Powód wyciszenia.")
        .setRequired(true)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    botPermissions: [PermissionFlagsBits.ModerateMembers],
  },

  run: async ({ interaction }) => {
    try {
      const targetUserId = interaction.options.getUser("target-user").id;
      const duration = interaction.options.getString("duration");
      const reason = interaction.options.getString("reason") || "Brak powodu.";

      await interaction.deferReply();

      const targetUser = await interaction.guild.members.fetch(targetUserId);

      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      const successEmbed = new EmbedBuilder()
        .setColor("#00BFFF")
        .addFields(
          { name: "Moderator:", value: `${interaction.user}`, inline: true },
          { name: "Powód:", value: `${reason}`, inline: true }
        )
        .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      if (!targetUser) {
        errorEmbed.setDescription(
          "**Taki użytkownik nie istnieje na tym serwerze.**"
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const msDuration = ms(duration);

      if (isNaN(msDuration) || msDuration < 5000 || msDuration > 2.419e9) {
        await interaction.editReply({
          content:
            "Podaj prawidłową wartość czasu trwania wyciszenia (5 sekund - 28 dni).",
          ephemeral: true,
        });
        return;
      }

      const targetUserRolePosition = targetUser.roles.highest.position;
      const requestUserRolePosition = interaction.member.roles.highest.position;
      const botRolePosition =
        interaction.guild.members.me.roles.highest.position;

      if (
        targetUserRolePosition >= requestUserRolePosition ||
        targetUserRolePosition >= botRolePosition
      ) {
        await interaction.editReply({
          content: "Nie możesz wyciszyć użytkownika z wyższą lub równą rolą.",
          ephemeral: true,
        });
        return;
      }

      const { default: prettyMs } = await import("pretty-ms");

      if (targetUser.isCommunicationDisabled()) {
        await targetUser.timeout(msDuration, reason);

        await interaction.editReply({
          embeds: [
            successEmbed.setDescription(
              `**Czas wyciszenia ${targetUser} został zaktualizowany: ${prettyMs(
                msDuration
              )}**`
            ),
          ],
        });
        return;
      }

      await targetUser.timeout(msDuration, reason);

      await interaction.editReply({
        embeds: [
          successEmbed.setDescription(
            `**${targetUser} został wyciszony na okres ${prettyMs(
              msDuration
            )}**`
          ),
        ],
      });
    } catch (error) {
      console.log(
        `Wystąpił błąd podczas wysyłania użytkownika na przerwę: ${error}`
      );

      await interaction.editReply({
        embeds: [
          errorEmbed.setDescription(
            "**Wystąpił błąd podczas wysyłania użytkownika na przerwę.**"
          ),
        ],
      });
    }
  },
};
