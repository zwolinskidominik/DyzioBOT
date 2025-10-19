import { EmbedBuilder, GuildMember, Guild, User } from 'discord.js';
import { createBaseEmbed } from '../utils/embedHelpers';
import { checkRole } from '../utils/roleHelpers';
import logger from '../utils/logger';
import ms from 'ms';
import prettyMs from 'pretty-ms';

export type ModAction = 'ban' | 'kick' | 'mute' | 'unban';

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

export function checkModPermissions(
  targetMember: GuildMember,
  requestMember: GuildMember,
  botMember: GuildMember | null
): boolean {
  if (!botMember) return false;
  return checkRole(targetMember, requestMember, botMember);
}

export function validateDuration(durationStr: string): number | null {
  const duration = ms(durationStr);
  if (isNaN(duration) || duration < 5_000 || duration > 2.419e9) {
    return null;
  }
  return duration;
}

export async function formatDuration(durationMs: number): Promise<string> {
  return prettyMs(durationMs, { verbose: false });
}

export async function findBannedUser(guild: Guild, userId: string): Promise<User | null> {
  try {
    const existing = guild.bans.cache.get(userId as any);
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
