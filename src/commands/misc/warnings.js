const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const Warn = require("../../models/Warn");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Sprawdza liczbę ostrzeżeń użytkownika.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription(
          "Użytkownik, którego liczba ostrzeżeń ma zostać sprawdzona."
        )
        .setRequired(false)
    ),

  run: async ({ interaction }) => {
    const userId =
      interaction.options.getUser("user")?.id || interaction.user.id;
    const guildId = interaction.guild.id;

    if (
      userId !== interaction.user.id &&
      !interaction.member.permissions.has(PermissionFlagsBits.MuteMembers)
    ) {
      await interaction.reply({
        content:
          "Nie masz uprawnień do sprawdzania ostrzeżeń innych użytkowników.",
        ephemeral: true,
      });
      return;
    }

    try {
      const warn = await Warn.findOne({ userId, guildId });

      const embed = createBaseEmbed({
        color: "#FFD700",
        title: `Liczba ostrzeżeń: ${warn ? warn.count : 0}`,
        footerText: `Na życzenie ${interaction.user.tag}`,
        footerIcon: interaction.user.displayAvatarURL(),
      });

      if (warn && warn.warnings.length > 0) {
        const warningList = warn.warnings
          .map(
            (w, index) =>
              `**⏱️ ${w.date.toLocaleString()}**\n` +
              `ID ostrzeżenia (**${index + 1}**) - Moderator: ${
                w.moderator
              }\n` +
              `\`${w.reason}\``
          )
          .join("\n\n");

        embed.setDescription(warningList);
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error(`Błąd podczas sprawdzania ostrzeżeń: ${error}`);
      await interaction.reply({
        content: "Wystąpił błąd podczas sprawdzania ostrzeżeń.",
        ephemeral: true,
      });
    }
  },
};
