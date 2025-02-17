const { SlashCommandBuilder } = require("discord.js");
const { createBaseEmbed } = require("../../utils/embedUtils");
const { Fortune, FortuneUsage } = require("../../models/Fortune");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wrozba")
    .setDescription("Sprawdź swoją wróżbę na dziś"),

  options: {
    deleted: true,
  },

  run: async ({ interaction }) => {
    try {
      await interaction.deferReply();

      const user = interaction.user;
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fortunes = await Fortune.find();
      if (!fortunes || fortunes.length === 0) {
        logger.warn("Brak wróżb w bazie. Nie można wyświetlić /wrozba");
        return await interaction.editReply({
          content:
            "Brak wróżb w bazie danych! Skontaktuj się z administratorem.",
          ephemeral: true,
        });
      }

      let usage = await FortuneUsage.findOne({
        userId: user.id,
        targetId: user.id,
      });

      if (!usage) {
        usage = new FortuneUsage({
          userId: user.id,
          targetId: user.id,
          lastUsedDay: today,
          dailyUsageCount: 0,
        });
      }

      const lastUsedDay = new Date(usage.lastUsedDay);
      lastUsedDay.setHours(0, 0, 0, 0);

      if (today.getTime() > lastUsedDay.getTime()) {
        usage.dailyUsageCount = 0;
        usage.lastUsedDay = today;
      }

      if (usage.dailyUsageCount >= 2) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const timeUntilReset = tomorrow - now;
        const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
        const minutesUntilReset = Math.floor(
          (timeUntilReset % (1000 * 60 * 60)) / (1000 * 60)
        );

        return await interaction.editReply({
          content: `Wykorzystałeś już limit wróżb na dzisiaj! Następne wróżby będą dostępne za ${hoursUntilReset}h i ${minutesUntilReset} min.`,
          ephemeral: true,
        });
      }

      const randomIndex = Math.floor(Math.random() * fortunes.length);
      const randomFortune = fortunes[randomIndex];

      usage.dailyUsageCount += 1;
      usage.lastUsed = now;
      await usage.save();

      const fortuneEmbed = createBaseEmbed({
        color: "#AA8DD8",
        title: "🔮 Twoja Wróżba",
        footerText: "Limit zresetuje się o 1:00",
      }).addFields(
        {
          name: "Przepowiednia",
          value: randomFortune.content || "Brak przepowiedni",
        },
        {
          name: "Pozostałe wróżby na dziś",
          value: `${2 - usage.dailyUsageCount}/2`,
        }
      );

      await interaction.editReply({ embeds: [fortuneEmbed] });
    } catch (error) {
      logger.error(`Błąd podczas wykonywania komendy /wrozba: ${error}`);
      await interaction.editReply({
        content: `Wystąpił błąd podczas sprawdzania wróżby: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
