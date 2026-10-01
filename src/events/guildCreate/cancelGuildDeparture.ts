import { Client, Guild } from 'discord.js';
import { cancelGuildDeparture } from '../../services/guildDataRetentionService';
import logger from '../../utils/logger';

/** Bot wrócił na serwer przed upływem okresu retencji — dane zostają. */
export default async function run(guild: Guild, _client: Client): Promise<void> {
  const result = await cancelGuildDeparture(guild.id);
  if (!result.ok) {
    logger.warn(`[Retention] Nie anulowano usunięcia danych serwera ${guild.id}: ${result.message}`);
  }
}
