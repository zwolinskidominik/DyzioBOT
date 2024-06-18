const { EmbedBuilder } = require("discord.js");

module.exports = {
  data: {
    name: "serverinfo",
    description: "Wyświetla informacje o serwerze.",
  },

  run: async ({ interaction }) => {
    try {
      if (!interaction.inGuild()) {
        await interaction.reply({
          content: "You can only run this command inside a server.",
          ephemeral: true,
        });
        return;
      }

      const { guild } = interaction;
      const { name, ownerId, memberCount } = guild;
      const icon = guild.iconURL();
      const roles = guild.roles.cache.size;
      const emojis = guild.emojis.cache.size;
      const id = guild.id;
      const joinedAt = interaction.member.joinedAt;

      let baseVerification;

      switch (guild.verificationLevel) {
        case 0:
          baseVerification = "Żaden";
          break;
        case 1:
          baseVerification = "Niski";
          break;
        case 2:
          baseVerification = "Średni";
          break;
        case 3:
          baseVerification = "Wysoki";
          break;
        case 4:
          baseVerification = "Bardzo wysoki";
          break;
        default:
          baseVerification = "Nieznany";
          break;
      }

      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setThumbnail(icon)
        .setFooter({ text: `Server ID: ${id}`, iconURL: icon })
        .setTimestamp()
        .addFields(
          { name: "Nazwa", value: name, inline: false },
          { name: "Właściciel", value: `<@${ownerId}>`, inline: true },
          {
            name: "Data utworzenia",
            value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          {
            name: "Dołączono",
            value: `<t:${Math.floor(joinedAt / 1000)}:R>`,
            inline: true,
          },
          { name: "Członkowie", value: `${memberCount}`, inline: true },
          { name: "Role", value: `${roles}`, inline: true },
          { name: "Emoji", value: `${emojis}`, inline: true },
          {
            name: "Stopień weryfikacji",
            value: baseVerification,
            inline: true,
          },
          {
            name: "Boosty",
            value: `${guild.premiumSubscriptionCount}`,
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
