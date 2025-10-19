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
  active: boolean;
  participants: string[];
  hostId: string;
  createdAt: Date;
  roleMultipliers: Record<string, number>;
  finalized: boolean;
}

export interface IGreetingsConfiguration {
  guildId: string;
  greetingsChannelId: string;
}

export interface IQuestion {
  questionId: string;
  authorId: string;
  content: string;
  reactions: string[];
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
  suggestionChannelId: string;
}

export interface ITempChannel {
  guildId: string;
  parentId: string;
  channelId: string;
  ownerId: string;
}

export interface ITempChannelConfiguration {
  guildId: string;
  channelId: string;
}

export interface ITicketConfig {
  guildId: string;
  categoryId: string;
}

export interface ITicketState {
  channelId: string;
  assignedTo?: string;
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
  moderator: string;
}

export interface IWarnDocument {
  userId: string;
  guildId: string;
  count: number;
  warnings: IWarnEntry[];
}
