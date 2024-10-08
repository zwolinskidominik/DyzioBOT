const cron = require("node-cron");
const Warn = require("../../models/Warn");
const { GUILD_ID } = process.env;

module.exports = async (client) => {
  cron.schedule("0 0 3 * * *", async () => {
    try {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const warnings = await Warn.find({ guildId: GUILD_ID });
      if (!warnings.length) {
        console.log("Brak ostrzeżeń do sprawdzenia.");
        return;
      }

      for (const warn of warnings) {
        const initialWarningCount = warn.warnings.length;

        warn.warnings = warn.warnings.filter(
          (warning) => warning.date > twoMonthsAgo
        );

        if (warn.warnings.length !== initialWarningCount) {
          warn.count = warn.warnings.length;
          await warn.save();
          console.log(
            `Zaktualizowano ostrzeżenia użytkownika o ID: ${warn.userId}.`
          );
        }
      }
    } catch (error) {
      console.error("Błąd podczas zerowania ostrzeżeń:", error);
    }
  });
};
