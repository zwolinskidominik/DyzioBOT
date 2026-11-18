import type { Guild } from 'discord.js';
import logger from '../../utils/logger';

/**
 * Ranga z `MC_STARTER_ROLE_ID` idzie razem z whitelistą: dodanie osoby ją nadaje, usunięcie zabiera.
 * Bot potrzebuje uprawnienia „Zarządzanie rolami” i musi stać w rolach wyżej niż ta ranga.
 */

export type RoleSyncResult = 'done' | 'not_member' | 'failed';

export async function syncStarterRole(guild: Guild, userId: string, roleId: string, give: boolean): Promise<RoleSyncResult> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return 'not_member';
  if (member.roles.cache.has(roleId) === give) return 'done';
  try {
    if (give) await member.roles.add(roleId, 'Dodano do whitelisty Minecraft');
    else await member.roles.remove(roleId, 'Usunięto z whitelisty Minecraft');
    return 'done';
  } catch (err) {
    logger.warn(`[MC] Nie udało się ${give ? 'nadać' : 'zabrać'} rangi (guild=${guild.id}, user=${userId}): ${err}`);
    return 'failed';
  }
}

/** Dopisek do odpowiedzi w panelu (pusty, gdy wszystko poszło dobrze). */
export function roleSyncNote(result: RoleSyncResult, give: boolean): string {
  if (result === 'failed') {
    return ` ⚠️ Nie udało się ${give ? 'nadać' : 'zabrać'} rangi: bot potrzebuje uprawnienia „Zarządzanie rolami” i musi być w rolach wyżej niż ta ranga.`;
  }
  if (result === 'not_member') return give ? ' Rangi nie nadano, bo tej osoby nie ma na serwerze.' : '';
  return '';
}
