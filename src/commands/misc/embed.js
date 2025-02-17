const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Stwórz embed.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName("title").setDescription("Tytuł embeda").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Opis embeda")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("Kolor embeda w formacie HEX (#000000)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("title2")
        .setDescription("Tytuł drugiego pola")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("description2")
        .setDescription("Opis drugiego pola")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("title3")
        .setDescription("Tytuł trzeciego pola")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("description3")
        .setDescription("Opis trzeciego pola")
        .setRequired(false)
    ),

  options: {
    userPermissions: [PermissionFlagsBits.Administrator],
    botPermissions: [PermissionFlagsBits.Administrator],
  },

  run: async ({ interaction }) => {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const color = interaction.options.getString("color") || "#2B2D31";
    const fields = [
      {
        title: interaction.options.getString("title2"),
        description: interaction.options.getString("description2"),
      },
      {
        title: interaction.options.getString("title3"),
        description: interaction.options.getString("description3"),
      },
    ].filter((field) => field.title && field.description);

    try {
      await interaction.deferReply();

      const embed = createBaseEmbed({
        title,
        description,
        color,
        footerText: interaction.guild.name,
        footerIcon: interaction.guild.iconURL(),
      });

      fields.forEach((field) => {
        embed.addFields({
          name: field.title,
          value: field.description,
          inline: true,
        });
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Błąd podczas tworzenia embeda: ${error}`);
      await interaction.editReply({
        content: "Wystąpił błąd podczas tworzenia embeda.",
        ephemeral: true,
      });
    }
  },
};
