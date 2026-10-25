import { Invite } from 'discord.js';
import { addInviteToCache } from '../../cache/inviteCache';
import { recordInvite } from '../../services/inviteUsageService';
import logger from '../../utils/logger';

/**
 * Nowe zaproszenie - dopisujemy je do pamięci (bez pobierania całej listy, patrz addInviteToCache)
 * i do trwałej historii liczników.
 */
export default async function run(invite: Invite): Promise<void> {
  try {
    if (!invite.guild || !('invites' in invite.guild)) return;
    addInviteToCache(invite.guild.id, invite);
    await recordInvite(invite.guild.id, invite);
  } catch (error) {
    logger.warn(`[InviteCache] Nie udało się zaktualizować cache po utworzeniu zaproszenia: ${error}`);
  }
}
