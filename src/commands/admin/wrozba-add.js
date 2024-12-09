const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { Fortune } = require("../../models/Fortune");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wrozba-add")
    .setDescription("Dodaj nową wróżbę do bazy danych")
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName("tekst").setDescription("Tekst wróżby").setRequired(true)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.MuteMembers],
    botPermissions: [PermissionFlagsBits.MuteMembers],
    deleted: true,
  },

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const fortuneText = interaction.options.getString("tekst");

      const fortune = await Fortune.create({
        content: fortuneText,
        addedBy: interaction.user.id,
      });

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("✨ Nowa wróżba dodana!")
        .setDescription(`Pomyślnie dodano nową wróżbę do bazy danych.`)
        .addFields({ name: "Treść", value: fortuneText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error("Błąd podczas dodawania wróżby:", error);
      await interaction.editReply({
        content: "Wystąpił błąd podczas dodawania wróżby.",
        ephemeral: true,
      });
    }
  },
};
