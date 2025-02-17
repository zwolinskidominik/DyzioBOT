const cron = require("node-cron");
const Birthday = require("../../models/Birthday");
const BirthdayConfiguration = require("../../models/BirthdayConfiguration");
const { GUILD_ID } = process.env;
const logger = require("../../utils/logger");

module.exports = async (client) => {
  cron.schedule("0 0 7 * * *", async () => {
    try {
      const birthdayConfig = await BirthdayConfiguration.findOne({
        guildId: GUILD_ID,
      });

      if (!birthdayConfig) {
        logger.warn("Konfiguracja kanału urodzinowego nie istnieje!");
        return;
      }

      const birthdayChannel = client.channels.cache.get(
        birthdayConfig.birthdayChannelId
      );
      if (!birthdayChannel) {
        logger.warn("Kanał urodzinowy nie istnieje!");
        return;
      }

      const today = new Date();
      const day = today.getUTCDate();
      const month = today.getUTCMonth() + 1;

      const birthdays = await Birthday.find({ guildId: GUILD_ID });
      const todaysBirthdays = birthdays.filter((birthday) => {
        const birthdayDate = new Date(birthday.date);
        return (
          birthdayDate.getUTCDate() === day &&
          birthdayDate.getUTCMonth() + 1 === month
        );
      });

      if (todaysBirthdays.length > 0) {
        for (const birthday of todaysBirthdays) {
          const user = await client.users
            .fetch(birthday.userId)
            .catch((err) => {
              logger.warn(
                `Nie udało się pobrać userId=${birthday.userId}: ${err}`
              );
            });
          if (user) {
            await birthdayChannel.send(
              `Wszystkiego najlepszego <@!${user.id}>! 🥳`
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Błąd podczas wysyłania wiadomości urodzinowych: ${error}`);
    }
  });
};
