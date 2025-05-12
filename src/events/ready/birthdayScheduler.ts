import { Client, TextChannel, ChannelType } from 'discord.js';
import { BirthdayModel } from '../../models/Birthday';
import { BirthdayConfigurationModel } from '../../models/BirthdayConfiguration';
import logger from '../../utils/logger';
import { env } from '../../config';
import { schedule } from 'node-cron';

const { GUILD_ID } = env();

export default async function run(client: Client): Promise<void> {
  schedule(
    '0 0 9 * * *',
    async () => {
      try {
        const birthdayConfig = await BirthdayConfigurationModel.findOne({ guildId: GUILD_ID });
        if (!birthdayConfig) {
          logger.warn('Konfiguracja kanału urodzinowego nie istnieje!');
          return;
        }

        const channel = client.channels.cache.get(birthdayConfig.birthdayChannelId);
        if (
          !channel ||
          (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildNews)
        ) {
          logger.warn('Kanał urodzinowy nie istnieje lub nie jest tekstowy!');
          return;
        }

        const birthdayChannel = channel as TextChannel;
        const today = new Date();
        const day = today.getUTCDate();
        const month = today.getUTCMonth() + 1;

        const birthdays = await BirthdayModel.find({ guildId: GUILD_ID });
        const todaysBirthdays = birthdays.filter((birthday) => {
          const birthdayDate = new Date(birthday.date);
          return birthdayDate.getUTCDate() === day && birthdayDate.getUTCMonth() + 1 === month;
        });

        for (const birthday of todaysBirthdays) {
          try {
            const user = await client.users.fetch(birthday.userId);
            if (user) {
              await birthdayChannel.send(`Wszystkiego najlepszego <@!${user.id}>! 🥳`);
            }
          } catch (err) {
            logger.warn(`Nie udało się pobrać userId=${birthday.userId}: ${err}`);
          }
        }
      } catch (error) {
        logger.error(`Błąd podczas wysyłania wiadomości urodzinowych: ${error}`);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}
