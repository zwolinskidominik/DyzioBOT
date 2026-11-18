import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

/**
 * Uprawnienia funkcji Minecraft - zawsze z interakcji (kto kliknął, na jakim serwerze), nigdy
 * z treści wpisanej przez użytkownika.
 */

export interface InteractionActor {
  userId: string;
  guildOwnerId: string | null;
  /** `interaction.memberPermissions` (uprawnienia klikającego na tym kanale). */
  permissions: Readonly<PermissionsBitField> | null;
  /** ID ról klikającego. */
  roleIds: readonly string[];
}

/** Whitelistą zarządza właściciel serwera Discord i każdy z uprawnieniem Administrator. */
export function canManageWhitelist(actor: InteractionActor): boolean {
  if (actor.guildOwnerId !== null && actor.userId === actor.guildOwnerId) return true;
  return actor.permissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

/** Serwer może uruchamiać tylko rola z MC_STARTER_ROLE_ID. */
export function canStartServer(actor: InteractionActor, starterRoleId: string): boolean {
  return actor.roleIds.includes(starterRoleId);
}

/** Role z `interaction.member` - bywa GuildMember (cache) albo surowy obiekt API (tablica ID). */
export function memberRoleIds(member: unknown): string[] {
  if (!member || typeof member !== 'object' || !('roles' in member)) return [];
  const roles = member.roles;
  if (Array.isArray(roles)) return roles.filter((id): id is string => typeof id === 'string');
  if (roles && typeof roles === 'object' && 'cache' in roles) {
    const cache = roles.cache;
    if (cache instanceof Map) return [...cache.keys()].filter((id): id is string => typeof id === 'string');
  }
  return [];
}
