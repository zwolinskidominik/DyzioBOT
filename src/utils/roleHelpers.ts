import { GuildMember } from 'discord.js';

export function checkRole(
  targetMember: GuildMember,
  requestMember: GuildMember,
  botMember: GuildMember
): boolean {
  if (!targetMember || !requestMember || !botMember) {
    throw new Error('Wszystkie trzy parametry muszą być dostarczone.');
  }
  if (targetMember.id === targetMember.guild.ownerId) {
    return false;
  }
  const targetPos = targetMember.roles.highest.position;
  const requestPos = requestMember.roles.highest.position;
  const botPos = botMember.roles.highest.position;

  if (targetPos >= requestPos) return false;
  if (targetPos >= botPos) return false;
  return true;
}
