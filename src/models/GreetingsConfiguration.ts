import { getModelForClass, prop, DocumentType } from '@typegoose/typegoose';

type GreetingMessageMode = 'embed' | 'text';
type GreetingImageMode = 'gifs' | 'custom' | 'none';
type GreetingThumbnailMode = 'avatar' | 'custom' | 'none';
type GreetingAuthorIconMode = 'avatar' | 'none';

class GreetingsConfiguration {
  @prop({ required: true, unique: true, type: () => String })
  public guildId!: string;

  @prop({ type: () => Boolean, default: false })
  public enabled!: boolean;

  @prop({ required: true, type: () => String })
  public greetingsChannelId!: string;

  @prop({ type: () => String })
  public goodbyeChannelId?: string;

  @prop({ type: () => String })
  public rulesChannelId?: string;

  @prop({ type: () => String })
  public rolesChannelId?: string;

  @prop({ type: () => String })
  public chatChannelId?: string;

  @prop({ type: () => Boolean, default: true })
  public welcomeEnabled!: boolean;

  @prop({ type: () => Boolean, default: true })
  public goodbyeEnabled!: boolean;

  @prop({ type: () => Boolean, default: false })
  public dmEnabled!: boolean;

  @prop({ type: () => String })
  public welcomeMessage?: string;

  @prop({ type: () => String, enum: ['embed', 'text'], default: 'embed' })
  public welcomeMessageMode?: GreetingMessageMode;

  @prop({ type: () => String, default: 'Witaj na {server}' })
  public welcomeTitleText?: string;

  @prop({ type: () => String })
  public goodbyeMessage?: string;

  @prop({ type: () => String, enum: ['embed', 'text'], default: 'embed' })
  public goodbyeMessageMode?: GreetingMessageMode;

  @prop({ type: () => String, default: 'Do zobaczenia, {username}' })
  public goodbyeTitleText?: string;

  @prop({ type: () => String, default: '#ef4444' })
  public goodbyeEmbedColor?: string;

  @prop({ type: () => String, default: '' })
  public goodbyeHeaderText?: string;

  @prop({ type: () => String, default: '' })
  public goodbyeFooterText?: string;

  @prop({ type: () => String, enum: ['gifs', 'custom', 'none'], default: 'none' })
  public goodbyeImageMode?: GreetingImageMode;

  @prop({ type: () => String, enum: ['avatar', 'custom', 'none'], default: 'avatar' })
  public goodbyeThumbnailMode?: GreetingThumbnailMode;

  @prop({ type: () => String })
  public goodbyeThumbnailFile?: string;

  @prop({ type: () => String })
  public goodbyeCustomImageFile?: string;

  @prop({ type: () => String })
  public goodbyeHeaderIconFile?: string;

  @prop({ type: () => String })
  public goodbyeFooterIconFile?: string;

  @prop({ type: () => String, enum: ['avatar', 'none'], default: 'avatar' })
  public goodbyeAuthorIconMode?: GreetingAuthorIconMode;

  @prop({ type: () => String })
  public dmMessage?: string;

  @prop({ type: () => String, enum: ['embed', 'text'], default: 'embed' })
  public dmMessageMode?: GreetingMessageMode;

  @prop({ type: () => String, default: 'Witaj na {server}' })
  public dmTitleText?: string;

  @prop({ type: () => String, default: '#3b82f6' })
  public dmEmbedColor?: string;

  @prop({ type: () => String, default: '' })
  public dmHeaderText?: string;

  @prop({ type: () => String, default: '' })
  public dmFooterText?: string;

  @prop({ type: () => String, enum: ['gifs', 'custom', 'none'], default: 'none' })
  public dmImageMode?: GreetingImageMode;

  @prop({ type: () => String, enum: ['avatar', 'custom', 'none'], default: 'avatar' })
  public dmThumbnailMode?: GreetingThumbnailMode;

  @prop({ type: () => String })
  public dmThumbnailFile?: string;

  @prop({ type: () => String })
  public dmCustomImageFile?: string;

  @prop({ type: () => String })
  public dmHeaderIconFile?: string;

  @prop({ type: () => String })
  public dmFooterIconFile?: string;

  @prop({ type: () => String, enum: ['avatar', 'none'], default: 'none' })
  public dmAuthorIconMode?: GreetingAuthorIconMode;

  @prop({ type: () => String, default: '#3b82f6' })
  public welcomeEmbedColor?: string;

  @prop({ type: () => String, default: '' })
  public welcomeHeaderText?: string;

  @prop({ type: () => String, default: '' })
  public welcomeFooterText?: string;

  @prop({ type: () => String, enum: ['gifs', 'custom', 'none'], default: 'gifs' })
  public welcomeImageMode?: GreetingImageMode;

  @prop({ type: () => String, enum: ['avatar', 'custom', 'none'], default: 'avatar' })
  public welcomeThumbnailMode?: GreetingThumbnailMode;

  @prop({ type: () => String })
  public welcomeThumbnailFile?: string;

  @prop({ type: () => String })
  public welcomeCustomImageFile?: string;

  @prop({ type: () => String })
  public welcomeHeaderIconFile?: string;

  @prop({ type: () => String })
  public welcomeFooterIconFile?: string;

  @prop({ type: () => String, enum: ['avatar', 'none'], default: 'none' })
  public welcomeAuthorIconMode?: GreetingAuthorIconMode;
}

export const GreetingsConfigurationModel = getModelForClass(GreetingsConfiguration);
export type GreetingsConfigurationDocument = DocumentType<GreetingsConfiguration>;
