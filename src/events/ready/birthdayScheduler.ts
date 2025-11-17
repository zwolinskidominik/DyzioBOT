import { Client, TextChannel, ChannelType } from 'discord.js';
import { BirthdayModel } from '../../models/Birthday';
import { BirthdayConfigurationModel } from '../../models/BirthdayConfiguration';
import logger from '../../utils/logger';
import { schedule } from 'node-cron';

export default async function run(client: Client): Promise<void> {
  schedule(
    '0 9 * * *',
    async () => {
      try {
        const birthdayConfigs = await BirthdayConfigurationModel.find({});
        
        if (birthdayConfigs.length === 0) {
          logger.warn('Konfiguracja urodzin nie istnieje!');
          return;
        }

        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;

        for (const birthdayConfig of birthdayConfigs) {
          try {
            const guild = client.guilds.cache.get(birthdayConfig.guildId);
            if (!guild) {
              logger.warn(`Serwer nie został znaleziony: ${birthdayConfig.guildId}`);
              continue;
            }

            const channel = guild.channels.cache.get(birthdayConfig.birthdayChannelId);
            if (
              !channel ||
              (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildNews)
            ) {
              logger.warn(`Kanał urodzinowy nie istnieje lub nie jest tekstowy: ${birthdayConfig.birthdayChannelId}`);
              continue;
            }

            const birthdayChannel = channel as TextChannel;

            const birthdays = await BirthdayModel.find({ guildId: birthdayConfig.guildId, active: true });
            const todaysBirthdays = birthdays.filter((birthday) => {
              return birthday.day === day && birthday.month === month;
            });

            for (const birthday of todaysBirthdays) {
              try {
                const member = await guild.members.fetch(birthday.userId);
                if (!member) {
                  logger.warn(`Użytkownik nie został znaleziony: ${birthday.userId}`);
                  continue;
                }

                const message = birthdayConfig.message || 'Wszystkiego najlepszego {user}! 🥳';
                const formattedMessage = message.replace('{user}', `<@${member.id}>`);
                
                try {
                  await birthdayChannel.send({
                    content: formattedMessage
                  });
                } catch (sendError) {
                  logger.error('Błąd podczas wysyłania wiadomości urodzinowej', sendError);
                }

                if (birthdayConfig.roleId) {
                  try {
                    await member.roles.add(birthdayConfig.roleId);
                  } catch (roleError) {
                    logger.error('Błąd podczas przypisywania roli urodzinowej', roleError);
                  }
                }
              } catch (memberError) {
                logger.warn(`Nie udało się pobrać członka ${birthday.userId}: ${memberError}`);
              }
            }



          } catch (guildError) {
            logger.error(`Błąd podczas przetwarzania guild ${birthdayConfig.guildId}:`, guildError);
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
