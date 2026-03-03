import { Client } from 'discord.js';
import { cacheAllGuildInvites } from '../../cache/inviteCache';
import logger from '../../utils/logger';

/**
 * On bot startup, cache all guild invites so we can detect
 * which invite was used when a new member joins.
 */
export default async function run(client: Client): Promise<void> {
  try {
    await cacheAllGuildInvites(client);
    logger.info('[InviteCache] Zaproszenia zostały zapisane w pamięci podręcznej.');
  } catch (error) {
    logger.error(`[InviteCache] Błąd podczas cache'owania zaproszeń: ${error}`);
  }
}
