const { SlashCommandBuilder } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Wyświetla avatar użytkownika w większym formacie.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Użytkownik, którego avatar chcesz zobaczyć.")
        .setRequired(false)
    ),
  run: async ({ interaction }) => {
    try {
      const targetUser =
        interaction.options.getUser("user") || interaction.user;

      const avatarURL = targetUser.displayAvatarURL({
        extension: "png",
        size: 1024,
      });

      const embed = createBaseEmbed({
        footerText: `ID: ${targetUser.id}`,
        title: `Avatar użytkownika ${targetUser.tag}`,
        image: avatarURL,
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Błąd podczas wyświetlania avataru: ${error}`);
      await interaction.reply({
        content:
          "Wystąpił błąd podczas próby wyświetlenia avataru użytkownika.",
        ephemeral: true,
      });
    }
  },
};
