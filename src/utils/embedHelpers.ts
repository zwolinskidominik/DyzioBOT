import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { IBaseEmbedOptions } from '../interfaces/Embed';
import { getGuildConfig } from '../config/guild';
import { COLORS } from '../config/constants/colors';

export function createBaseEmbed(options: IBaseEmbedOptions = {}): EmbedBuilder {
  const {
    isError = false,
    color = '',
    title = '',
    description = '',
    footerText = '',
    footerIcon = '',
    image = '',
    thumbnail = '',
    authorName = '',
    authorIcon = '',
    authorUrl = '',
    url = '',
    timestamp = false,
  } = options;

  const finalColor = color || (isError ? COLORS.ERROR : COLORS.DEFAULT);
  const embed = new EmbedBuilder().setColor(finalColor as ColorResolvable);
  if (timestamp) embed.setTimestamp();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (footerText) {
    embed.setFooter({ text: footerText, iconURL: footerIcon || undefined });
  }
  if (image) embed.setImage(image);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (authorName) {
    embed.setAuthor({
      name: authorName,
      iconURL: authorIcon || undefined,
      url: authorUrl || undefined,
    });
  }
  if (url) embed.setURL(url);

  return embed;
}

export function formatResults(
  guildId: string,
  upvotes: string[] = [],
  downvotes: string[] = []
): string {
  const {
    emojis: { suggestionPB },
  } = getGuildConfig(guildId);

  const total = upvotes.length + downvotes.length;
  const length = 14;
  const filled = total ? Math.round((upvotes.length / total) * length) : 0;
  const empty = length - filled;
  const upP = total ? (upvotes.length / total) * 100 : 0;
  const downP = total ? (downvotes.length / total) * 100 : 0;

  const bar =
    (filled ? suggestionPB.lf : suggestionPB.le) +
    suggestionPB.mf.repeat(filled) +
    suggestionPB.me.repeat(empty) +
    (filled === length ? suggestionPB.rf : suggestionPB.re);

  return `👍 ${upvotes.length} głosów na tak (${upP.toFixed(1)}%) • 👎 ${downvotes.length} głosów na nie (${downP.toFixed(1)}%)\n${bar}`;
}

export function formatWarnBar(guildId: string, count: number): string {
  const {
    emojis: { warnPB },
  } = getGuildConfig(guildId);

  const length = 9;
  const maxWarnings = 3;
  const filled = Math.round((count / maxWarnings) * length);
  const empty = length - filled;

  const start = filled > 0 ? warnPB.lf : warnPB.le;
  const middleFull = filled > 1 ? warnPB.mf.repeat(filled - 1) : '';
  const middleEmpty = empty > 1 ? warnPB.me.repeat(empty - 1) : '';
  const end = filled === length ? warnPB.rf : warnPB.re;

  return `${start}${middleFull}${middleEmpty}${end}`;
}
