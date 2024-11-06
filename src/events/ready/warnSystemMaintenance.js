const cron = require("node-cron");
const Warn = require("../../models/Warn");
const { GUILD_ID } = process.env;

/**
 * Moduł odpowiedzialny za kompleksową obsługę systemu ostrzeżeń i banów.
 * Wykonuje następujące zadania:
 * - Usuwa ostrzeżenia starsze niż 2 miesiące
 * - Odblokowuje użytkowników po upływie czasu bana
 * - Resetuje licznik ostrzeżeń dla odbanowanych użytkowników
 * - Wysyła powiadomienia o odblokowaniu do użytkowników
 */

module.exports = async (client) => {
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const warnings = await Warn.find({ guildId: GUILD_ID });
      if (!warnings.length) {
        console.log("Brak ostrzeżeń do sprawdzenia.");
        return;
      }

      for (const warn of warnings) {
        if (warn.banUntil && warn.banUntil <= now) {
          const guild = await client.guilds.fetch(GUILD_ID);
          try {
            await guild.members.unban(warn.userId, "Ban wygasł");
            console.log(`Odbanowano użytkownika o ID: ${warn.userId}`);

            warn.count = 0;
            warn.warnings = [];
            warn.banUntil = null;
          } catch (error) {
            console.error(
              `Błąd podczas odbanowywania użytkownika o ID: ${warn.userId}`,
              error
            );
          }
        }

        warn.warnings = warn.warnings.filter(
          (warning) => warning.date > twoMonthsAgo
        );
        warn.count = warn.warnings.length;

        await warn.save();
      }
    } catch (error) {
      console.error("Błąd podczas aktualizacji ostrzeżeń:", error);
    }
  });
};
