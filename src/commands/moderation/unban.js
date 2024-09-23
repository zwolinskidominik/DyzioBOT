const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Odbanowuje użytkownika na serwerze.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("target-user")
        .setDescription("Użytkownik, którego chcesz odbanować.")
        .setRequired(true)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions: [PermissionFlagsBits.BanMembers],
  },

  run: async ({ interaction }) => {
    try {
      const targetUserId = interaction.options.getString("target-user");

      const errorEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      const successEmbed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setThumbnail(member.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: interaction.guild.name });

      await interaction.deferReply();

      const bannedUsers = await interaction.guild.bans.fetch();
      const bannedUser = bannedUsers.find(
        (user) => user.user.id === targetUserId
      );

      if (!bannedUser) {
        await interaction.editReply({
          embeds: [
            errorEmbed.setDescription(
              "**Nie znaleziono użytkownika na liście banów.**"
            ),
          ],
        });
        return;
      }

      const member = bannedUser.user;

      await interaction.guild.bans.remove(targetUserId);

      await interaction.editReply({
        embeds: [
          successEmbed
            .setDescription(
              `**Użytkownik ${member.username} został odbanowany**`
            )
            .addFields({
              name: "Moderator:",
              value: `${interaction.user}`,
              inline: true,
            }),
        ],
      });
    } catch (error) {
      console.log(`Wystąpił błąd podczas próby odbanowania: ${error}`);

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
