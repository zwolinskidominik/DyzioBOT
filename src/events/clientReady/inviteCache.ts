import { Client } from 'discord.js';
import { cacheAllGuildInvites } from '../../cache/inviteCache';
import { syncGuildInvites } from '../../services/inviteUsageService';
import logger from '../../utils/logger';

/**
 * On bot startup, cache all guild invites so we can detect
 * which invite was used when a new member joins — i zapisuje ich liczniki w trwałej historii.
 */
export default async function run(client: Client): Promise<void> {
  try {
    await cacheAllGuildInvites(client, async (guildId, invites) => {
      await syncGuildInvites(guildId, invites);
    });
    logger.info('[InviteCache] Zaproszenia zostały zapisane w pamięci podręcznej.');
  } catch (error) {
    logger.error(`[InviteCache] Błąd podczas cache'owania zaproszeń: ${error}`);
  }
}
