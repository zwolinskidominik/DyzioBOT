import { Client, Collection, Invite } from 'discord.js';
import logger from '../utils/logger';

/**
 * In-memory cache of guild invites.
 * Maps guildId → Map<inviteCode, uses>.
 */
const inviteCache = new Map<string, Map<string, number>>();

/**
 * Fetches all invites for a guild and stores them in the cache.
 */
export async function cacheGuildInvites(guildId: string, invites: Collection<string, Invite>): Promise<void> {
  const map = new Map<string, number>();
  for (const [code, invite] of invites) {
    map.set(code, invite.uses ?? 0);
  }
  inviteCache.set(guildId, map);
}

/**
 * Caches invites for all guilds the bot is in.
 */
export async function cacheAllGuildInvites(client: Client): Promise<void> {
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const invites = await guild.invites.fetch();
      await cacheGuildInvites(guildId, invites);
    } catch (error) {
      logger.warn(`[InviteCache] Nie można pobrać zaproszeń dla ${guild.name}: ${error}`);
    }
  }
}

/**
 * Gets the cached invite uses for a guild.
 */
export function getCachedInvites(guildId: string): Map<string, number> | undefined {
  return inviteCache.get(guildId);
}

/**
 * Compares old cached invites with freshly fetched invites to find which invite was used.
 * Returns the invite code and inviter ID if detected, or null.
 */
export async function detectUsedInvite(
  guildId: string,
  newInvites: Collection<string, Invite>,
): Promise<{ code: string; inviterId: string | null } | null> {
  const oldInvites = inviteCache.get(guildId);

  if (!oldInvites) {
    // No cache — update cache and return null
    await cacheGuildInvites(guildId, newInvites);
    return null;
  }

  for (const [code, invite] of newInvites) {
    const oldUses = oldInvites.get(code) ?? 0;
    const newUses = invite.uses ?? 0;

    if (newUses > oldUses) {
      // Update cache with new state
      await cacheGuildInvites(guildId, newInvites);
      return {
        code,
        inviterId: invite.inviter?.id ?? null,
      };
    }
  }

  // Check if an invite was used and then deleted (single-use invite)
  for (const [code] of oldInvites) {
    if (!newInvites.has(code)) {
      // This invite disappeared — it was likely a single-use or max-use invite
      await cacheGuildInvites(guildId, newInvites);
      // We can't determine the inviter from a deleted invite
      return { code, inviterId: null };
    }
  }

  // Update the cache anyway
  await cacheGuildInvites(guildId, newInvites);
  return null;
}

/**
 * Clears cache for a guild (e.g. when bot leaves).
 */
export function clearGuildCache(guildId: string): void {
  inviteCache.delete(guildId);
}

/**
 * Resets entire cache — for testing.
 */
export function _resetCache(): void {
  inviteCache.clear();
}
