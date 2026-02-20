import { schedule } from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { cleanExpiredWarns } from '../../services/warnService';
import logger from '../../utils/logger';

export default async function run(): Promise<void> {
  schedule(
    CRON.WARN_MAINTENANCE,
    async () => {
      try {
        const guildId = process.env.GUILD_ID;
        if (!guildId) {
          logger.warn('GUILD_ID is not set — skipping warn maintenance');
          return;
        }

        const result = await cleanExpiredWarns({ guildId });
        if (result.ok && result.data.totalRemoved > 0) {
          logger.info(
            `🧹 Warn maintenance: usunięto ${result.data.totalRemoved} ostrzeżeń (${result.data.usersAffected} użytkowników)`
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
