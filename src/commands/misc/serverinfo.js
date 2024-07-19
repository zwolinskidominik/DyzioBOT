const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Wyświetla informacje o serwerze.")
    .setDMPermission(false),

  run: async ({ interaction }) => {
    try {
      const { guild, member } = interaction;
      const {
        name,
        ownerId,
        memberCount,
        roles,
        emojis,
        id,
        createdTimestamp,
        premiumSubscriptionCount,
        verificationLevel,
      } = guild;
      const icon = guild.iconURL();
      const joinedAt = member.joinedAt;

      const verificationLevels = [
        "Żaden",
        "Niski",
        "Średni",
        "Wysoki",
        "Bardzo wysoki",
      ];
      const baseVerification =
        verificationLevels[verificationLevel] || "Nieznany";

      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setThumbnail(icon)
        .setFooter({ text: `Server ID: ${id}`, iconURL: icon })
        .setTimestamp()
        .addFields(
          { name: "Nazwa", value: name, inline: false },
          { name: "Właściciel", value: `<@!${ownerId}>`, inline: true },
          {
            name: "Data utworzenia",
            value: `<t:${Math.floor(createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          {
            name: "Dołączono",
            value: `<t:${Math.floor(joinedAt / 1000)}:R>`,
            inline: true,
          },
          { name: "Członkowie", value: `${memberCount}`, inline: true },
          { name: "Role", value: `${roles.cache.size}`, inline: true },
          { name: "Emoji", value: `${emojis.cache.size}`, inline: true },
          {
            name: "Stopień weryfikacji",
            value: baseVerification,
            inline: true,
          },
          {
            name: "Boosty",
            value: `${premiumSubscriptionCount}`,
            inline: true,
          }
        );

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Błąd podczas wyświetlania informacji o serwerze:", error);
      await interaction.reply({
        content: "Wystąpił błąd podczas wyświetlania informacji o serwerze.",
        ephemeral: true,
      });
    }
  },
};
