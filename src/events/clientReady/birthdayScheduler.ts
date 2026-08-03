import { Client, TextChannel, ChannelType } from 'discord.js';
import { getTodayBirthdays, getBirthdayConfigs } from '../../services/birthdayService';
import { addTempRole } from '../../services/tempRoleService';
import { getMsUntilMidnight } from '../../utils/timeHelpers';
import logger from '../../utils/logger';
import { schedule } from 'node-cron';
import { CRON } from '../../config/constants/cron';

export default async function run(client: Client): Promise<void> {
  schedule(
    CRON.BIRTHDAY_CHECK,
    async () => {
      try {
        const configResult = await getBirthdayConfigs();
        if (!configResult.ok) {
          logger.error(`Błąd pobierania konfiguracji urodzin: ${configResult.message}`);
          return;
        }

        const birthdayConfigs = configResult.data;
        if (birthdayConfigs.length === 0) {
          logger.warn('Konfiguracja urodzin nie istnieje!');
          return;
        }

        for (const birthdayConfig of birthdayConfigs) {
          try {
            if (birthdayConfig.enabled === false) {
              continue;
            }

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

            const todayResult = await getTodayBirthdays({ guildId: birthdayConfig.guildId });
            if (!todayResult.ok) continue;

            for (const entry of todayResult.data) {
              try {
                const member = await guild.members.fetch(entry.userId);
                if (!member) {
                  logger.warn(`Użytkownik nie został znaleziony: ${entry.userId}`);
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

                    // Rola urodzinowa ma obowiązywać tylko do końca dnia — rejestrujemy ją
                    // jako tymczasową (jak /role temp), żeby istniejący hourly TEMP_ROLE_CHECK
                    // cron (tempRoleScheduler.ts) automatycznie ją zdjął po północy.
                    const durationMs = getMsUntilMidnight('Europe/Warsaw');
                    const trackResult = await addTempRole(
                      birthdayConfig.guildId,
                      member.id,
                      birthdayConfig.roleId,
                      durationMs,
                      client.user?.id ?? 'system',
                      'Rola urodzinowa – automatyczne zdjęcie o północy'
                    );
                    if (!trackResult.ok) {
                      logger.error(
                        `Błąd podczas zapisywania wygaśnięcia roli urodzinowej: ${trackResult.message}`
                      );
                    }
                  } catch (roleError) {
                    logger.error('Błąd podczas przypisywania roli urodzinowej', roleError);
                  }
                }
              } catch (memberError) {
                logger.warn(`Nie udało się pobrać członka ${entry.userId}: ${memberError}`);
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
