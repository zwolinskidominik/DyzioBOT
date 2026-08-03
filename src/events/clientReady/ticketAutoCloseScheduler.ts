import { Client, TextChannel } from 'discord.js';
import { schedule } from 'node-cron';
import { CRON } from '../../config/constants/cron';
import { findIdleTicketGroups } from '../../services/ticketService';
import { finalizeTicketClosure } from '../../utils/ticketClosure';
import logger from '../../utils/logger';

export default async function run(client: Client): Promise<void> {
  schedule(
    CRON.TICKET_AUTOCLOSE_CHECK,
    async () => {
      try {
        const groups = await findIdleTicketGroups();

        for (const group of groups) {
          const guild = client.guilds.cache.get(group.guildId);
          if (!guild) continue;

          for (const channelId of group.channelIds) {
            try {
              const channel = guild.channels.cache.get(channelId);
              if (!channel || !channel.isTextBased()) continue;

              logger.info(
                `[TICKET AUTOCLOSE] Zamykanie nieaktywnego ticketu ${channelId} (serwer ${group.guildId}, próg ${group.autoCloseHours}h)`,
              );
              await finalizeTicketClosure(
                channel as TextChannel,
                `automatyczne zamknięcie po ${group.autoCloseHours}h bezczynności`,
              );
            } catch (err) {
              logger.warn(`[TICKET AUTOCLOSE] Błąd zamykania ticketu ${channelId}: ${err}`);
            }
          }
        }
      } catch (error) {
        logger.error(`[TICKET AUTOCLOSE] Błąd zadania cyklicznego: ${error}`);
      }
    },
    { timezone: 'Europe/Warsaw' },
  );
}
