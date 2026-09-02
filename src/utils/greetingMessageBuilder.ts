import { AttachmentBuilder, EmbedBuilder, GuildMember, MessageCreateOptions } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { COLORS } from '../config/constants/colors';
import { IGreetingsConfiguration } from '../interfaces/Models';
import { GreetingGifStateModel } from '../models/GreetingGifState';
import { createBaseEmbed } from './embedHelpers';
import logger from './logger';

type GreetingModuleKey = 'welcome' | 'dm' | 'goodbye';
type GreetingImageMode = 'gifs' | 'custom' | 'none';
type GreetingThumbnailMode = 'avatar' | 'custom' | 'none';
type GreetingAuthorIconMode = 'avatar' | 'none';
type GreetingMessageMode = 'embed' | 'text';

interface GreetingAttachment {
  attachment: AttachmentBuilder;
  name: string;
}

interface GreetingModuleConfig {
  messageMode?: GreetingMessageMode;
  message?: string;
  titleText?: string;
  embedColor?: string;
  headerText?: string;
  footerText?: string;
  imageMode?: GreetingImageMode;
  thumbnailMode?: GreetingThumbnailMode;
  thumbnailFile?: string;
  customImageFile?: string;
  footerIconFile?: string;
  authorIconMode?: GreetingAuthorIconMode;
}

interface BuildGreetingMessageOptions {
  member: GuildMember;
  config: IGreetingsConfiguration;
  moduleKey: GreetingModuleKey;
  defaultMessage: string;
  defaultTitle: string;
  defaultColor: string;
  mentionUser?: boolean;
  directMessage?: boolean;
}

export interface BuiltGreetingMessage {
  payload: MessageCreateOptions;
  hasEmbed: boolean;
}

function isSafeAssetFileName(fileName?: string): fileName is string {
  return Boolean(
    fileName &&
    !fileName.includes('..') &&
    !fileName.includes('/') &&
    !fileName.includes('\\') &&
    /\.(gif|jpe?g|png|webp)$/i.test(fileName)
  );
}

function getAssetAttachment(guildId: string, fileName: string | undefined, baseName: string): GreetingAttachment | null {
  if (!isSafeAssetFileName(fileName)) {
    return null;
  }

  const imagePath = path.join(process.cwd(), 'assets', 'greetings', 'uploads', guildId, fileName);
  if (!fs.existsSync(imagePath)) {
    return null;
  }

  const extension = path.extname(fileName) || '.png';
  const attachmentName = `${baseName}${extension}`;

  return {
    attachment: new AttachmentBuilder(imagePath, { name: attachmentName }),
    name: attachmentName,
  };
}

async function getRandomLobbyGif(guildId: string, moduleKey: GreetingModuleKey): Promise<GreetingAttachment | null> {
  try {
    const gifsDir = path.join(process.cwd(), 'assets', 'lobby');
    const uploadsDir = path.join(gifsDir, 'uploads', guildId);

    if (!fs.existsSync(gifsDir)) {
      logger.warn('Greeting GIF folder does not exist', { guildId, gifsDir });
      return null;
    }

    const disabledStates = await GreetingGifStateModel
      .find({ guildId, disabled: true })
      .select('fileName')
      .lean();
    const disabledFiles = new Set(disabledStates.map((state) => state.fileName));

    const defaultGifFiles = fs
      .readdirSync(gifsDir)
      .filter((file) => file.toLowerCase().endsWith('.gif') && !disabledFiles.has(file))
      .map((file) => ({ file, filePath: path.join(gifsDir, file) }));

    const uploadedGifFiles = fs.existsSync(uploadsDir)
      ? fs
          .readdirSync(uploadsDir)
          .filter((file) => file.toLowerCase().endsWith('.gif') && !disabledFiles.has(file))
          .map((file) => ({ file, filePath: path.join(uploadsDir, file) }))
      : [];

    const gifFiles = [...defaultGifFiles, ...uploadedGifFiles];
    if (gifFiles.length === 0) {
      logger.warn('No active greeting GIF files available', { guildId });
      return null;
    }

    const randomGif = gifFiles[Math.floor(Math.random() * gifFiles.length)];
    const attachmentName = `${moduleKey}-greeting.gif`;

    return {
      attachment: new AttachmentBuilder(randomGif.filePath, { name: attachmentName }),
      name: attachmentName,
    };
  } catch (error) {
    logger.error('Failed to load greeting GIF', { guildId, error });
    return null;
  }
}

function getModuleConfig(config: IGreetingsConfiguration, moduleKey: GreetingModuleKey): GreetingModuleConfig {
  if (moduleKey === 'dm') {
    return {
      messageMode: config.dmMessageMode,
      message: config.dmMessage,
      titleText: config.dmTitleText,
      embedColor: config.dmEmbedColor,
      headerText: config.dmHeaderText,
      footerText: config.dmFooterText,
      imageMode: config.dmImageMode,
      thumbnailMode: config.dmThumbnailMode,
      thumbnailFile: config.dmThumbnailFile,
      customImageFile: config.dmCustomImageFile,
      footerIconFile: config.dmFooterIconFile,
      authorIconMode: config.dmAuthorIconMode,
    };
  }

  if (moduleKey === 'goodbye') {
    return {
      messageMode: config.goodbyeMessageMode,
      message: config.goodbyeMessage,
      titleText: config.goodbyeTitleText,
      embedColor: config.goodbyeEmbedColor,
      headerText: config.goodbyeHeaderText,
      footerText: config.goodbyeFooterText,
      imageMode: config.goodbyeImageMode,
      thumbnailMode: config.goodbyeThumbnailMode,
      thumbnailFile: config.goodbyeThumbnailFile,
      customImageFile: config.goodbyeCustomImageFile,
      footerIconFile: config.goodbyeFooterIconFile,
      authorIconMode: config.goodbyeAuthorIconMode,
    };
  }

  return {
    messageMode: config.welcomeMessageMode,
    message: config.welcomeMessage,
    titleText: config.welcomeTitleText,
    embedColor: config.welcomeEmbedColor,
    headerText: config.welcomeHeaderText,
    footerText: config.welcomeFooterText,
    imageMode: config.welcomeImageMode,
    thumbnailMode: config.welcomeThumbnailMode,
    thumbnailFile: config.welcomeThumbnailFile,
    customImageFile: config.welcomeCustomImageFile,
    footerIconFile: config.welcomeFooterIconFile,
    authorIconMode: config.welcomeAuthorIconMode,
  };
}

function replaceGreetingVariables(message: string, member: GuildMember, config: IGreetingsConfiguration, directMessage: boolean): string {
  const rulesChannel = config.rulesChannelId ? `<#${config.rulesChannelId}>` : 'kanał regulaminu';
  const rolesChannel = config.rolesChannelId ? `<#${config.rolesChannelId}>` : 'kanał ról';
  const chatChannel = config.chatChannelId ? `<#${config.chatChannelId}>` : 'kanał czatu';
  const replacements: Record<string, string> = {
    '{user}': directMessage ? member.user.username : `<@${member.user.id}>`,
    '{server}': member.guild.name,
    '{memberCount}': member.guild.memberCount.toString(),
    '{username}': member.user.username,
    '{rulesChannel}': rulesChannel,
    '{rolesChannel}': rolesChannel,
    '{chatChannel}': chatChannel,
  };

  return Object.entries(replacements).reduce(
    (content, [variable, value]) => content.split(variable).join(value),
    message
  );
}

function parseEmbedColor(color: string | undefined, fallbackColor: string): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallbackColor;
}

function getFallbackThumbnail(member: GuildMember, moduleKey: GreetingModuleKey, directMessage: boolean): string | undefined {
  if (directMessage) {
    return member.guild.iconURL({ size: 256 }) || undefined;
  }

  if (moduleKey === 'goodbye') {
    return member.user.displayAvatarURL({ size: 128 });
  }

  return member.user.displayAvatarURL({ extension: 'png', size: 256 });
}

function createAllowedMentions(member: GuildMember): MessageCreateOptions['allowedMentions'] {
  return {
    users: [member.user.id],
    roles: [],
    parse: [],
  };
}

export async function buildGreetingMessage(options: BuildGreetingMessageOptions): Promise<BuiltGreetingMessage> {
  const { member, config, moduleKey, defaultMessage, defaultTitle, defaultColor, mentionUser = false, directMessage = false } = options;
  const moduleConfig = getModuleConfig(config, moduleKey);
  const messageTemplate = moduleConfig.message?.trim() || defaultMessage;
  const titleTemplate = moduleConfig.titleText?.trim() || defaultTitle;
  const message = replaceGreetingVariables(messageTemplate, member, config, directMessage);
  const title = replaceGreetingVariables(titleTemplate, member, config, directMessage);
  const mode = moduleConfig.messageMode || 'embed';

  if (mode === 'text') {
    return {
      hasEmbed: false,
      payload: {
        content: message,
        allowedMentions: createAllowedMentions(member),
      },
    };
  }

  const files: AttachmentBuilder[] = [];
  const thumbnailMode: GreetingThumbnailMode = moduleConfig.thumbnailMode || (moduleConfig.thumbnailFile ? 'custom' : 'avatar');
  const thumbnailData = thumbnailMode === 'custom'
    ? getAssetAttachment(member.guild.id, moduleConfig.thumbnailFile, `${moduleKey}-thumbnail`)
    : null;
  const footerIconData = getAssetAttachment(member.guild.id, moduleConfig.footerIconFile, `${moduleKey}-footer-icon`);
  const authorIconMode: GreetingAuthorIconMode = moduleConfig.authorIconMode || (moduleKey === 'goodbye' ? 'avatar' : 'none');
  const imageMode = moduleConfig.imageMode || (moduleKey === 'goodbye' ? 'none' : 'gifs');
  let imageData: GreetingAttachment | null = null;

  if (imageMode === 'custom') {
    imageData = getAssetAttachment(member.guild.id, moduleConfig.customImageFile, `${moduleKey}-image`);
  } else if (imageMode === 'gifs') {
    imageData = await getRandomLobbyGif(member.guild.id, moduleKey);
  }

  [thumbnailData, footerIconData, imageData].forEach((item) => {
    if (item) files.push(item.attachment);
  });

  const headerText = moduleConfig.headerText?.trim()
    ? replaceGreetingVariables(moduleConfig.headerText.trim(), member, config, directMessage)
    : undefined;
  const footerText = moduleConfig.footerText?.trim()
    ? replaceGreetingVariables(moduleConfig.footerText.trim(), member, config, directMessage)
    : undefined;
  const thumbnailUrl = thumbnailMode === 'none'
    ? undefined
    : thumbnailData
      ? `attachment://${thumbnailData.name}`
      : getFallbackThumbnail(member, moduleKey, directMessage);
  const embed = createBaseEmbed({
    color: parseEmbedColor(moduleConfig.embedColor, defaultColor),
    title,
    description: message,
    thumbnail: thumbnailUrl,
    authorName: headerText,
    authorIcon: headerText && authorIconMode === 'avatar' ? getFallbackThumbnail(member, moduleKey, directMessage) : undefined,
    footerText,
    footerIcon: footerText ? footerIconData ? `attachment://${footerIconData.name}` : member.guild.iconURL({ size: 128 }) || undefined : undefined,
  });

  if (imageData) {
    embed.setImage(`attachment://${imageData.name}`);
  }

  const payload: MessageCreateOptions = {
    embeds: [embed as EmbedBuilder],
    allowedMentions: createAllowedMentions(member),
  };

  if (mentionUser && !directMessage) {
    payload.content = `<@${member.user.id}>`;
  }

  if (files.length > 0) {
    payload.files = files;
  }

  return {
    hasEmbed: true,
    payload,
  };
}

export const GREETING_DEFAULT_COLORS = {
  welcome: COLORS.JOIN,
  dm: COLORS.JOIN,
  goodbye: COLORS.LEAVE,
};
