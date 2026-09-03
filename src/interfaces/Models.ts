export interface IChannelsConfig {
  lastJoined?: IChannelInfo;
  users?: IChannelInfo;
  bots?: IChannelInfo;
  bans?: IChannelInfo;
}

export interface IChannelInfo {
  channelId?: string;
  template?: string;
  member?: string;
}

export interface IChannelStats {
  guildId: string;
  channels: IChannelsConfig;
}

export interface IFortune {
  content: string;
  addedBy?: string;
}

export interface IGiveaway {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  description: string;
  winnersCount: number;
  endTime: Date;
  pingRoleId?: string;
  imageUrl?: string;
  active: boolean;
  participants: string[];
  hostId: string;
  createdAt: Date;
  roleMultipliers?: Record<string, number>;
  finalized: boolean;
}

export interface IGreetingsConfiguration {
  guildId: string;
  enabled?: boolean;
  greetingsChannelId: string;
  goodbyeChannelId?: string;
  rulesChannelId?: string;
  rolesChannelId?: string;
  chatChannelId?: string;
  welcomeEnabled?: boolean;
  goodbyeEnabled?: boolean;
  dmEnabled?: boolean;
  welcomeMessageMode?: 'embed' | 'text';
  welcomeMessage?: string;
  welcomeTitleText?: string;
  welcomeEmbedColor?: string;
  welcomeHeaderText?: string;
  welcomeFooterText?: string;
  welcomeImageMode?: 'gifs' | 'custom' | 'none';
  welcomeThumbnailMode?: 'avatar' | 'custom' | 'none';
  welcomeThumbnailFile?: string;
  welcomeCustomImageFile?: string;
  welcomeHeaderIconFile?: string;
  welcomeFooterIconFile?: string;
  welcomeAuthorIconMode?: 'avatar' | 'none';
  dmMessageMode?: 'embed' | 'text';
  dmMessage?: string;
  dmTitleText?: string;
  dmEmbedColor?: string;
  dmHeaderText?: string;
  dmFooterText?: string;
  dmImageMode?: 'gifs' | 'custom' | 'none';
  dmThumbnailMode?: 'avatar' | 'custom' | 'none';
  dmThumbnailFile?: string;
  dmCustomImageFile?: string;
  dmHeaderIconFile?: string;
  dmFooterIconFile?: string;
  dmAuthorIconMode?: 'avatar' | 'none';
  goodbyeMessageMode?: 'embed' | 'text';
  goodbyeMessage?: string;
  goodbyeTitleText?: string;
  goodbyeEmbedColor?: string;
  goodbyeHeaderText?: string;
  goodbyeFooterText?: string;
  goodbyeImageMode?: 'gifs' | 'custom' | 'none';
  goodbyeThumbnailMode?: 'avatar' | 'custom' | 'none';
  goodbyeThumbnailFile?: string;
  goodbyeCustomImageFile?: string;
  goodbyeHeaderIconFile?: string;
  goodbyeFooterIconFile?: string;
  goodbyeAuthorIconMode?: 'avatar' | 'none';
}

export interface ITempChannelConfiguration {
  guildId: string;
  /** @deprecated legacy field kept for backward compatibility — derived from `creators` on every save. */
  channelIds: string[];
  creators: { channelId: string; type: 'panel' | 'standard' }[];
}

export type ITicketBannerMode = 'preset' | 'text' | 'none';

export interface ITicketTypeBanner {
  mode: ITicketBannerMode;
  presetId?: string;
  text?: string;
}

export interface ITicketType {
  id: string;
  emoji: string;
  name: string;
  description: string;
  roleIds: string[];
  color: string;
  banner: ITicketTypeBanner;
  thumbnail?: string | undefined;
}

export interface ITicketAutomation {
  maxOpenPerUser: number;
  autoCloseHours: number;
  transcriptEnabled: boolean;
  transcriptChannelId?: string;
}

export interface ITicketPanelMessage {
  emoji?: string;
  title: string;
  description: string;
  color: string;
  placeholder: string;
  banner: ITicketTypeBanner;
}

export interface ITicketConfig {
  guildId: string;
  enabled: boolean;
  categoryId: string;
  panelChannelId?: string;
  panelMessageId?: string;
  types: ITicketType[];
  automation: ITicketAutomation;
  panelMessage: ITicketPanelMessage;
}

export interface ITicketState {
  channelId: string;
  guildId?: string;
  assignedTo?: string;
  typeId?: string;
  creatorId?: string;
  lastActivityAt?: Date;
}

export interface IWarnEntry {
  reason: string;
  date: Date;
  moderatorId: string;
  moderatorTag?: string;
  moderator?: string;
}

export interface IReactionRoleMapping {
  emoji: string;
  roleId: string;
  description?: string;
}

export interface IMonthlyStats {
  guildId: string;
  userId: string;
  month: string;
  messageCount: number;
  voiceMinutes: number;
  updatedAt: Date;
}

export interface IMonthlyStatsConfig {
  guildId: string;
  channelId?: string;
  enabled: boolean;
  topCount: number;
}

export interface IInviteEntry {
  guildId: string;
  inviterId?: string | null;
  joinedUserId: string;
  inviteCode?: string | null;
  active: boolean;
  fake: boolean;
  joinedAt: Date;
  leftAt?: Date | null;
}
