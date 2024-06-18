const cron = require("node-cron");
const Birthday = require("../../models/Birthday");
const BirthdayConfiguration = require("../../models/BirthdayConfiguration");
const { GUILD_ID } = process.env;

module.exports = async (client) => {
  const job = cron.schedule("0 0 7 * * *", async () => {
    try {
      const birthdayConfig = await BirthdayConfiguration.findOne({
        guildId: GUILD_ID,
      });

      if (!birthdayConfig) {
        console.error("Konfiguracja kanału urodzinowego nie istnieje!");
        return;
      }

      const birthdayChannel = client.channels.cache.get(
        birthdayConfig.birthdayChannelId
      );

      if (!birthdayChannel) {
        console.error("Kanał urodzinowy nie istnieje!");
        return;
      }

      const today = new Date();
      const day = today.getUTCDate();
      const month = today.getUTCMonth() + 1;

      const birthdays = await Birthday.find();

      const todaysBirthdays = birthdays.filter((birthday) => {
        const birthdayDate = new Date(birthday.date);
        return (
          birthdayDate.getUTCDate() === day &&
          birthdayDate.getUTCMonth() + 1 === month
        );
      });

      if (todaysBirthdays.length > 0) {
        for (const birthday of todaysBirthdays) {
          const user = await client.users.fetch(birthday.userId);
          if (user) {
            await birthdayChannel.send(
              `Wszystkiego najlepszego <@${user.id}>! 🥳`
            );
          }
        }
      } else {
        console.log("Dzisiaj nikt nie ma urodzin.");
      }
    } catch (error) {
      console.error("Błąd podczas wysyłania wiadomości urodzinowych:", error);
    }
  });
};
