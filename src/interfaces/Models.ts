export interface IAutoRole {
  guildId: string;
  roleIds: string[];
}

export interface IBirthday {
  userId: string;
  guildId: string;
  date: Date;
  yearSpecified: boolean;
  active: boolean;
}

export interface IBirthdayConfiguration {
  guildId: string;
  birthdayChannelId: string;
  roleId?: string;
  message?: string;
}

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

export interface IFortuneUsage {
  userId: string;
  targetId: string;
  lastUsed: Date;
  lastUsedDay: Date;
  dailyUsageCount: number;
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
}

export interface IQuestion {
  questionId: string;
  authorId: string;
  content: string;
  reactions: string[];
  disabled: boolean;
}

export interface IUsedQuestion {
  guildId: string;
  questionId: string;
  usedAt: Date;
}

export interface IQuestionConfiguration {
  guildId: string;
  questionChannelId: string;
  pingRoleId?: string;
}

export interface IStreamConfiguration {
  guildId: string;
  channelId: string;
}

export interface ISuggestion {
  suggestionId: string;
  authorId: string;
  guildId: string;
  messageId: string;
  content: string;
  upvotes: string[];
  upvoteUsernames: string[];
  downvotes: string[];
  downvoteUsernames: string[];
}

export interface ISuggestionConfiguration {
  guildId: string;
  enabled: boolean;
  suggestionChannelId: string;
  votingFormat: 'counts' | 'percent' | 'bar';
  anonymous: boolean;
  embedColor: string;
}

export interface ITempChannel {
  guildId: string;
  parentId: string;
  channelId: string;
  ownerId: string;
  controlMessageId?: string;
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

export interface ITicketStats {
  guildId: string;
  userId: string;
  count: number;
}

export interface ITwitchStreamer {
  guildId: string;
  twitchChannel: string;
  userId: string;
  isLive: boolean;
  active: boolean;
}

export interface IWarnEntry {
  reason: string;
  date: Date;
  moderatorId: string;
  moderatorTag?: string;
  moderator?: string;
}

export interface IWarnDocument {
  userId: string;
  guildId: string;
  count: number;
  warnings: IWarnEntry[];
}

export interface IReactionRoleMapping {
  emoji: string;
  roleId: string;
  description?: string;
}

export interface IReactionRole {
  guildId: string;
  channelId: string;
  messageId: string;
  title?: string;
  reactions: IReactionRoleMapping[];
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

export interface ITournamentConfig {
  guildId: string;
  enabled: boolean;
  messageTemplate: string;
  cronSchedule: string;
  reactionEmoji: string;
}

export interface IInviteTrackerConfig {
  guildId: string;
  enabled: boolean;
  logChannelId?: string | null;
  joinMessage?: string;
  joinMessageUnknown?: string;
  joinMessageVanity?: string;
  leaveMessage?: string;
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
