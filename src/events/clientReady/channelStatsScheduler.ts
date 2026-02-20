import { Client } from 'discord.js';
import cron from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { updateChannelStats } from '../../utils/channelHelpers';
import logger from '../../utils/logger';

export default async function run(client: Client): Promise<void> {
  cron.schedule(CRON.CHANNEL_STATS_UPDATE, async () => {
    try {
      const guilds = client.guilds.cache;
      let updated = 0;
      let errors = 0;

      for (const [guildId, guild] of guilds) {
        try {
          await updateChannelStats(guild);
          updated++;
        } catch (error) {
          errors++;
          logger.error(`Błąd aktualizacji statystyk dla guild ${guildId}: ${error}`);
        }
      }
    } catch (error) {
      logger.error(`Błąd w schedulerze statystyk kanałów: ${error}`);
    }
  });
}
