import { Client, EmbedBuilder, TextChannel, GuildMember } from 'discord.js';
import { LogConfigurationModel } from '../models/LogConfiguration';
import { LogEventType, LOG_EVENT_CONFIGS } from '../interfaces/LogEvent';
import logger from './logger';

/** Lean (plain-object) representation of a LogConfiguration document. */
interface LeanLogConfiguration {
  guildId: string;
  enabled: boolean;
  logChannels: Record<string, string>;
  enabledEvents: Record<string, boolean>;
  ignoredChannels?: string[];
  ignoredRoles?: string[];
  ignoredUsers?: string[];
  colorOverrides?: Record<string, string>;
}

export interface LogEmbedData {
  title?: string | null;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  authorName?: string;
  authorIcon?: string;
  image?: string;
  thumbnail?: string;
  footer?: string;
  footerIcon?: string;
  timestamp?: boolean | Date;
}

export interface LogContext {
  channelId?: string;
  userId?: string;
  member?: GuildMember;
}

export function createLogEmbed(eventType: LogEventType, data: LogEmbedData): EmbedBuilder {
  const config = LOG_EVENT_CONFIGS[eventType];
  
  const embed = new EmbedBuilder().setColor(config.color);

  if (data.timestamp instanceof Date) {
    embed.setTimestamp(data.timestamp);
  } else if (data.timestamp !== false) {
    embed.setTimestamp(new Date());
  }

  if (data.title === undefined) {
    embed.setTitle(`${config.emoji} ${config.name}`);
  } else if (data.title) {
    embed.setTitle(data.title);
  }

  if (data.description) {
    embed.setDescription(data.description);
  }

  if (data.fields && data.fields.length > 0) {
    embed.addFields(data.fields);
  }

  if (data.authorName) {
    embed.setAuthor({
      name: data.authorName,
      iconURL: data.authorIcon,
    });
  }

  if (data.image) {
    embed.setImage(data.image);
  }

  if (data.thumbnail) {
    embed.setThumbnail(data.thumbnail);
  }

  if (data.footer) {
    embed.setFooter({ 
      text: data.footer,
      iconURL: data.footerIcon 
    });
  }

  return embed;
}

export async function sendLog(
  client: Client,
  guildId: string,
  eventType: LogEventType,
  embedData: LogEmbedData,
  context?: LogContext
): Promise<void> {
  try {
    const config = await LogConfigurationModel.findOne({ guildId }).lean<LeanLogConfiguration>();
    
    if (!config) return;
    if (!config.enabledEvents?.[eventType]) return;

    // Check ignored channels/users/roles
    if (context) {
      if (context.channelId && config.ignoredChannels?.includes(context.channelId)) return;
      if (context.userId && config.ignoredUsers?.includes(context.userId)) return;
      if (context.member && config.ignoredRoles) {
        const hasIgnoredRole = config.ignoredRoles.some(roleId =>
          context.member!.roles.cache.has(roleId)
        );
        if (hasIgnoredRole) return;
      }
    }
    
    const channelId = config.logChannels?.[eventType];
    if (!channelId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel?.send) return;

    const embed = createLogEmbed(eventType, embedData);
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error(`Błąd podczas wysyłania logu ${eventType}: ${error}`);
  }
}

export function truncate(text: string, maxLength: number = 1024): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
