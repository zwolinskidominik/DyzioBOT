const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const { Fortune } = require("../../models/Fortune");
const logger = require("../../utils/logger");

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

      const embed = createBaseEmbed({
        title: "✨ Nowa wróżba dodana!",
        description: `Pomyślnie dodano nową wróżbę do bazy danych.`,
        color: "#00FF00",
      }).addFields({ name: "Treść", value: fortuneText });

      await interaction.editReply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error(`Błąd podczas dodawania wróżby: ${error}`);

      await interaction.editReply({
        content: "Wystąpił błąd podczas dodawania wróżby.",
        ephemeral: true,
      });
    }
  },
};
