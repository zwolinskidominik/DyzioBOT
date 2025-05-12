import { EmbedBuilder, GuildMember, Guild, User, Collection, GuildBan } from 'discord.js';
import { createBaseEmbed } from '../utils/embedHelpers';
import { checkRole } from '../utils/roleHelpers';
import logger from '../utils/logger';
import ms from 'ms';

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
  moderatorName: User,
  guildIcon: string | null | undefined,
  guildName: string,
  reason?: string,
  duration?: string
): EmbedBuilder {
  let description: string;

  switch (action) {
    case 'ban':
      description = `### Zbanowano użytkownika ${target}`;
      break;
    case 'kick':
      description = `### Wyrzucono użytkownika ${target}`;
      break;
    case 'mute':
      description = duration
        ? `**${target} został wyciszony na okres ${duration}**`
        : `**${target} został wyciszony**`;
      break;
    case 'unban':
      description = `### Odbanowano użytkownika ${target}`;
      break;
  }

  const embed = createBaseEmbed({
    isError: action !== 'unban',
    description,
    thumbnail: target.displayAvatarURL(),
    footerText: guildName,
    footerIcon: guildIcon || undefined,
  });

  embed.addFields({ name: 'Moderator', value: `${moderatorName}`, inline: true });

  if (reason && (action === 'ban' || action === 'kick' || action === 'mute')) {
    embed.addFields({ name: 'Powód:', value: reason, inline: true });
  }

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

export async function formatDuration(ms: number): Promise<string> {
  const { default: prettyMs } = await import('pretty-ms');
  return prettyMs(ms);
}

export async function findBannedUser(guild: Guild, userId: string): Promise<User | null> {
  try {
    const bannedUsers: Collection<string, GuildBan> = await guild.bans.fetch();
    const bannedUser = bannedUsers.find((ban) => ban.user.id === userId);
    return bannedUser ? bannedUser.user : null;
  } catch (error) {
    logger.error(`Błąd podczas pobierania listy banów: ${error}`);
    return null;
  }
}
