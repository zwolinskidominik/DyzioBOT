import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { IBaseEmbedOptions } from '../interfaces/Embed';
import { getBotConfig } from '../config/bot';
import { COLORS } from '../config/constants/colors';

export function createBaseEmbed(opts: IBaseEmbedOptions = {}): EmbedBuilder {
  const finalColor = (opts.color ||
    (opts.isError ? COLORS.ERROR : COLORS.DEFAULT)) as ColorResolvable;
  const embed = new EmbedBuilder().setColor(finalColor);
  if (opts.timestamp) embed.setTimestamp();
  if (opts.title) embed.setTitle(opts.title);
  if (opts.description) embed.setDescription(opts.description);
  if (opts.footerText)
    embed.setFooter({ text: opts.footerText, iconURL: opts.footerIcon || undefined });
  if (opts.image) embed.setImage(opts.image);
  if (opts.thumbnail) embed.setThumbnail(opts.thumbnail);
  if (opts.authorName) {
    embed.setAuthor({
      name: opts.authorName,
      iconURL: opts.authorIcon || undefined,
      url: opts.authorUrl || undefined,
    });
  }
  if (opts.url) embed.setURL(opts.url);
  return embed;
}

/** Universal error embed for any command — red color with ❌ prefix. */
export function createErrorEmbed(description: string): EmbedBuilder {
  return createBaseEmbed({
    isError: true,
    description: `❌ ${description}`,
  });
}

export function formatResults(
  botId: string,
  upvotes: string[] = [],
  downvotes: string[] = []
): string {
  const {
    emojis: { suggestionPB },
  } = getBotConfig(botId);

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

export function formatWarnBar(botId: string, count: number): string {
  const {
    emojis: { warnPB },
  } = getBotConfig(botId);

  const length = 9;
  const maxWarnings = 3;
  const filled = Math.round((Math.min(count, maxWarnings) / maxWarnings) * length);
  const empty = length - filled;

  const start = filled > 0 ? warnPB.lf : warnPB.le;
  const middleFull = filled > 1 ? warnPB.mf.repeat(filled - 1) : '';
  const middleEmpty = empty > 1 ? warnPB.me.repeat(empty - 1) : '';
  const end = filled === length ? warnPB.rf : warnPB.re;

  return `${start}${middleFull}${middleEmpty}${end}`;
}
