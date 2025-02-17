const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const TicketStats = require("../../models/TicketStats");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-stats")
    .setDescription(
      "Wyświetla statystyki obsługi zgłoszeń dla moderatorów, administratorów i właściciela."
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .setDMPermission(false),

  options: {
    userPermissions: [PermissionFlagsBits.MuteMembers],
  },

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply();
      const guildId = interaction.guild.id;
      const stats = await TicketStats.find({ guildId }).sort({ count: -1 });

      if (!stats || stats.length === 0) {
        return interaction.editReply(
          "Brak statystyk zgłoszeń na tym serwerze."
        );
      }

      const description = stats
        .map((stat, index) => {
          const userMention = `<@!${stat.userId}>`;
          return `**${index + 1}. ${userMention} - pomógł/pomogła ${
            stat.count
          } razy**`;
        })
        .join("\n");

      const now = new Date();
      const timeString = now.toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const footerText = `${interaction.guild.name} • Dziś o ${timeString}`;

      const embed = createBaseEmbed({
        title: "Statystyki zgłoszeń",
        description: description,
        color: "#00BFFF",
        footerText: footerText,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Błąd podczas pobierania statystyk ticketów: ${error}`);
      await interaction.editReply(
        "Wystąpił błąd podczas pobierania statystyk."
      );
    }
  },
};
