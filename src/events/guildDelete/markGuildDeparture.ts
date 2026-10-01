import { Client, Guild } from 'discord.js';
import { GUILD_DATA_RETENTION_DAYS, markGuildDeparted } from '../../services/guildDataRetentionService';
import logger from '../../utils/logger';

/**
 * Bot został usunięty z serwera (wyrzucony, serwer skasowany). discord.js emituje guildDelete
 * wyłącznie w takim przypadku — chwilowa niedostępność serwera idzie osobnym zdarzeniem
 * guildUnavailable — więc każde wywołanie tutaj to realne odejście.
 */
export default async function run(guild: Guild, _client: Client): Promise<void> {
  const result = await markGuildDeparted(guild.id);
  if (!result.ok) {
    logger.warn(`[Retention] Nie zapisano odejścia z serwera ${guild.id}: ${result.message}`);
    return;
  }
  logger.info(
    `[Retention] Bot usunięty z serwera ${guild.id} — dane zostaną skasowane za ${GUILD_DATA_RETENTION_DAYS} dni, jeśli nie wróci.`
  );
}
