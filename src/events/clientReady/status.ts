import { Client, ActivityType, PresenceStatusData } from 'discord.js';
import logger from '../../utils/logger';

export default async function run(client: Client): Promise<void> {
  if (!client.user) {
    return;
  }

  await client.user.setPresence({
    activities: [
      {
        name: '/help',
        type: ActivityType.Playing,
      },
    ],
    status: 'online' as PresenceStatusData,
  });

  // Ustaw pseudonim "Dyzio" na głównym serwerze
  const mainGuildId = process.env.GUILD_ID;
  if (mainGuildId) {
    try {
      const guild = client.guilds.cache.get(mainGuildId) ?? await client.guilds.fetch(mainGuildId);
      await guild.members.me?.setNickname('Dyzio');
    } catch (error) {
      logger.warn(`Nie udało się ustawić pseudonimu na głównym serwerze: ${error}`);
    }
  }
}
