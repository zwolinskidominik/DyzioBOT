const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

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

      const embed = new EmbedBuilder()
        .setTitle(`Avatar użytkownika: ${targetUser.tag}`)
        .setImage(avatarURL)
        .setColor("#00BFFF")
        .setFooter({ text: `ID: ${targetUser.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Błąd podczas wyświetlania avataru: ", error);
      await interaction.reply({
        content:
          "Wystąpił błąd podczas próby wyświetlenia avataru użytkownika.",
        ephemeral: true,
      });
    }
  },
};
