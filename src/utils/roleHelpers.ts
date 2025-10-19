import { GuildMember } from 'discord.js';

export type RoleCheckFailReason =
  | 'MISSING_PARAM'
  | 'TARGET_IS_OWNER'
  | 'SELF_ACTION'
  | 'TARGET_NOT_LOWER_THAN_REQUESTER'
  | 'TARGET_NOT_LOWER_THAN_BOT';

export interface RoleCheckResult {
  allowed: boolean;
  reason?: RoleCheckFailReason;
}

export function canModerate(
  targetMember: GuildMember | null | undefined,
  requestMember: GuildMember | null | undefined,
  botMember: GuildMember | null | undefined
): RoleCheckResult {
  if (!targetMember || !requestMember || !botMember) {
    return { allowed: false, reason: 'MISSING_PARAM' };
  }
  if (targetMember.id === targetMember.guild.ownerId) {
    return { allowed: false, reason: 'TARGET_IS_OWNER' };
  }
  if (targetMember.id === requestMember.id) {
    return { allowed: false, reason: 'SELF_ACTION' };
  }
  const targetPos = targetMember.roles.highest.position;
  const requestPos = requestMember.roles.highest.position;
  const botPos = botMember.roles.highest.position;
  if (targetPos >= requestPos) {
    return { allowed: false, reason: 'TARGET_NOT_LOWER_THAN_REQUESTER' };
  }
  if (targetPos >= botPos) {
    return { allowed: false, reason: 'TARGET_NOT_LOWER_THAN_BOT' };
  }
  return { allowed: true };
}

export function checkRole(
  targetMember: GuildMember,
  requestMember: GuildMember,
  botMember: GuildMember
): boolean {
  return canModerate(targetMember, requestMember, botMember).allowed;
}
