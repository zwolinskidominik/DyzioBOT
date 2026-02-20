import { EmbedBuilder, GuildMember, Guild, User } from 'discord.js';
import { createBaseEmbed } from '../utils/embedHelpers';
import logger from '../utils/logger';
import prettyMs from 'pretty-ms';
import { parseDuration } from './parseDuration';

export { parseDuration };

// ── Role check (merged from roleHelpers.ts) ─────────────────────────

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

// ── Moderation helpers ───────────────────────────────────────────────

export type ModAction = 'ban' | 'kick' | 'mute' | 'unban' | 'warn';

const ACTION_LABELS: Record<ModAction, string> = {
  ban: 'zbanować',
  kick: 'wyrzucić',
  mute: 'wyciszyć',
  unban: 'odbanować',
  warn: 'ostrzec',
};

const FAIL_MESSAGES: Record<RoleCheckFailReason, (verb: string) => string> = {
  MISSING_PARAM: () => 'Wystąpił błąd podczas sprawdzania uprawnień.',
  TARGET_IS_OWNER: (v) => `Nie możesz ${v} właściciela serwera.`,
  SELF_ACTION: (v) => `Nie możesz ${v} samego siebie.`,
  TARGET_NOT_LOWER_THAN_REQUESTER: (v) => `Nie możesz ${v} użytkownika z wyższą lub równą rolą.`,
  TARGET_NOT_LOWER_THAN_BOT: (v) => `Moja rola jest za niska, aby ${v} tego użytkownika.`,
};

export function getModFailMessage(
  targetMember: GuildMember,
  requestMember: GuildMember,
  botMember: GuildMember | null,
  action: ModAction
): string | null {
  if (!botMember) return FAIL_MESSAGES.MISSING_PARAM(ACTION_LABELS[action]);
  const result = canModerate(targetMember, requestMember, botMember);
  if (result.allowed) return null;
  return FAIL_MESSAGES[result.reason!](ACTION_LABELS[action]);
}

export function createModErrorEmbed(description: string, guildName?: string): EmbedBuilder {
  return createBaseEmbed({
    isError: true,
    description: description ? `**${description}**` : '',
    footerText: guildName,
  });
}

export function createModSuccessEmbed(
  action: ModAction,
  target: User,
  moderator: User,
  guildIcon: string | null | undefined,
  guildName: string,
  reason?: string,
  duration?: string
): EmbedBuilder {
  const actionDescriptions: Record<ModAction, string> = {
    ban: `### Zbanowano użytkownika <@!${target.id}>`,
    kick: `### Wyrzucono użytkownika <@!${target.id}>`,
    mute: duration
      ? `**<@!${target.id}> został wyciszony na okres ${duration}**`
      : `**<@!${target.id}> został wyciszony**`,
    unban: `### Odbanowano użytkownika <@!${target.id}>`,
    warn: `### Ostrzeżono użytkownika <@!${target.id}>`,
  };

  const embed = createBaseEmbed({
    isError: false,
    description: actionDescriptions[action],
    thumbnail: target.displayAvatarURL(),
    footerText: guildName,
    footerIcon: guildIcon || undefined,
  });

  embed.addFields({ name: 'Moderator', value: `<@!${moderator.id}>`, inline: true });
  if (reason && action !== 'unban') embed.addFields({ name: 'Powód', value: reason, inline: true });
  if (duration && action === 'mute')
    embed.addFields({ name: 'Czas', value: duration, inline: true });
  return embed;
}

export function formatHumanDuration(durationMs: number): string {
  return prettyMs(durationMs, { verbose: false });
}

export async function findBannedUser(guild: Guild, userId: string): Promise<User | null> {
  try {
    const existing = guild.bans.cache.get(userId as `${bigint}`);
    if (existing) return existing.user;
    const ban = await guild.bans.fetch(userId).catch(() => null);
    return ban?.user ?? null;
  } catch (error) {
    logger.error(
      `Błąd podczas sprawdzania bana użytkownika ${userId} na guild=${guild.id}: ${error}`
    );
    return null;
  }
}
