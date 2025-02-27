const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const Warn = require("../../models/Warn");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn-remove")
    .setDescription("Usuwa ostrzeżenie użytkownika o podanym identyfikatorze.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("target-user")
        .setDescription("Użytkownik, któremu chcesz usunąć ostrzeżenie.")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("warning-id")
        .setDescription("Identyfikator ostrzeżenia do usunięcia.")
        .setRequired(true)
    ),

  run: async ({ interaction }) => {
    await interaction.deferReply();

    const targetUserId = interaction.options.getUser("target-user").id;
    const warningId = interaction.options.getInteger("warning-id");
    const guildId = interaction.guild.id;

    try {
      const errorEmbed = createBaseEmbed({
        isError: true,
        footerText: interaction.guild.name,
      });

      const successEmbed = createBaseEmbed({
        isError: true,
        footerText: interaction.guild.name,
      });

      const warn = await Warn.findOne({ userId: targetUserId, guildId });

      if (!warn) {
        errorEmbed.setDescription("Użytkownik nie posiada żadnych ostrzeżeń.");
        return await interaction.editReply({
          embeds: [errorEmbed],
          ephemeral: true,
        });
      }

      if (warningId > warn.warnings.length || warningId <= 0) {
        errorEmbed.setDescription(
          `Nie znaleziono ostrzeżenia o ID: ${warningId}.`
        );
        return await interaction.editReply({
          embeds: [errorEmbed],
          ephemeral: true,
        });
      }

      warn.warnings.splice(warningId - 1, 1);
      warn.count--;

      await warn.save();

      successEmbed
        .setDescription(
          `Ostrzeżenie o ID: ${warningId} zostało usunięte dla użytkownika <@!${targetUserId}>.`
        )
        .setThumbnail(
          interaction.options
            .getUser("target-user")
            .displayAvatarURL({ dynamic: true })
        );

      await interaction.editReply({
        embeds: [successEmbed],
        ephemeral: true,
      });
    } catch (error) {
      logger.error(
        `Błąd podczas usuwania ostrzeżenia userId=${targetUserId}: ${error}`
      );

      const errorEmbed = createBaseEmbed({
        isError: true,
        description: "Wystąpił błąd podczas usuwania ostrzeżenia.",
      });
      await interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
  },
};
