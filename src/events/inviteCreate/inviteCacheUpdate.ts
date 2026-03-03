import { Invite, Guild } from 'discord.js';
import { cacheGuildInvites } from '../../cache/inviteCache';
import logger from '../../utils/logger';

/**
 * When a new invite is created, re-cache the guild's invites
 * so the invite tracker can detect usage accurately.
 */
export default async function run(invite: Invite): Promise<void> {
  try {
    if (!invite.guild || !('invites' in invite.guild)) return;
    const guild = invite.guild as Guild;

    const invites = await guild.invites.fetch();
    await cacheGuildInvites(guild.id, invites);
  } catch (error) {
    logger.warn(`[InviteCache] Nie udało się zaktualizować cache po utworzeniu zaproszenia: ${error}`);
  }
}
