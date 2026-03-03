import { schedule } from 'node-cron';
import { Client } from 'discord.js';
import { CRON } from '../../config/constants/cron';
import { collectExpiredTempRoles } from '../../services/tempRoleService';
import logger from '../../utils/logger';

export default async function run(client: Client): Promise<void> {
  schedule(
    CRON.TEMP_ROLE_CHECK,
    async () => {
      try {
        const result = await collectExpiredTempRoles();
        if (!result.ok) return;

        for (const entry of result.data) {
          try {
            const guild = client.guilds.cache.get(entry.guildId);
            if (!guild) continue;

            const member = await guild.members.fetch(entry.userId).catch(() => null);
            if (!member) continue;

            if (member.roles.cache.has(entry.roleId)) {
              await member.roles.remove(entry.roleId, 'Temp role – czas wygasł');
              logger.info(
                `[TempRole] Usunięto rolę ${entry.roleId} z użytkownika ${entry.userId} na serwerze ${entry.guildId}`
              );
            }
          } catch (error) {
            logger.error(
              `[TempRole] Błąd podczas usuwania wygasłej roli ${entry.roleId} z ${entry.userId}: ${error}`
            );
          }
        }
      } catch (error) {
        logger.error(`[TempRole] Błąd w schedulerze: ${error}`);
      }
    },
    { timezone: 'Europe/Warsaw' }
  );
}
