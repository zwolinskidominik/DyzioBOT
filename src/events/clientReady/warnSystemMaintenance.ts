import { schedule } from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { cleanExpiredWarns } from '../../services/warnService';
import logger from '../../utils/logger';

export default async function run(): Promise<void> {
  schedule(
    CRON.WARN_MAINTENANCE,
    async () => {
      try {
        // Bez guildId → cleanExpiredWarns czyści ostrzeżenia na WSZYSTKICH serwerach.
        // Wcześniej brano tylko process.env.GUILD_ID (jeden, sztywno ustawiony serwer),
        // przez co ostrzeżenia na pozostałych serwerach nigdy nie wygasały — bot jest
        // multi-tenant, więc to musi objąć każdą gildię.
        const result = await cleanExpiredWarns({});
        if (result.ok && result.data.totalRemoved > 0) {
          logger.info(
            `🧹 Warn maintenance: usunięto ${result.data.totalRemoved} ostrzeżeń (${result.data.usersAffected} użytkowników, wszystkie serwery)`
          );
        }
      } catch (error) {
        logger.error('Błąd podczas utrzymania systemu ostrzeżeń', error);
      }
    },
    {
      timezone: 'Europe/Warsaw',
    }
  );
}
