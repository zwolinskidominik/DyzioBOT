const cron = require('node-cron');
const Birthday = require('../../models/Birthday');
const BirthdayConfiguration = require('../../models/BirthdayConfiguration');
const { GUILD_ID } = process.env;

module.exports = async (client) => {
  const job = cron.schedule('0 0 10 * * *', async () => {
    try {
      const birthdayConfig = await BirthdayConfiguration.findOne({ guildId: GUILD_ID });

      if (!birthdayConfig) {
        console.error('Konfiguracja kanału urodzinowego nie istnieje!');
        return;
      }

      const birthdayChannel = client.channels.cache.get(birthdayConfig.birthdayChannelId);

      if (!birthdayChannel) {
        console.error('Kanał urodzinowy nie istnieje!');
        return;
      }

      const today = new Date();
      const day = today.getUTCDate();
      const month = today.getUTCMonth();

      const birthdays = await Birthday.find({
        $expr: {
          $and: [
            { $eq: [{ $dayOfMonth: "$date" }, day] },
            { $eq: [{ $month: "$date" }, month] }
          ]
        }
      });

      if (birthdays.length > 0) {
        for (const birthday of birthdays) {
          const user = await client.users.fetch(birthday.userId);
          if (user) {
            await birthdayChannel.send(`Wszystkiego najlepszego <@${user.id}>! 🥳`);
          }
        }
      } else {
        console.log('Dzisiaj nikt nie ma urodzin.');
      }
    } catch (error) {
      console.error('Błąd podczas wysyłania wiadomości urodzinowych:', error);
    }
  }, {
    timezone: "UTC"
  });
};
