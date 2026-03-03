import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

export type AntiSpamAction = 'timeout' | 'warn' | 'kick' | 'ban';

@modelOptions({
  schemaOptions: {
    collection: 'antispamconfigs',
    timestamps: true,
  },
})
export class AntiSpamConfig {
  @prop({ required: true, unique: true, type: String })
  public guildId!: string;

  @prop({ type: Boolean, default: false })
  public enabled!: boolean;

  /** Number of messages within the time window that triggers spam detection. */
  @prop({ type: Number, default: 5 })
  public messageThreshold!: number;

  /** Time window in milliseconds. */
  @prop({ type: Number, default: 3000 })
  public timeWindowMs!: number;

  /** Action to take when spam is detected. */
  @prop({ type: String, default: 'timeout' })
  public action!: AntiSpamAction;

  /** Timeout duration in milliseconds (used when action = 'timeout'). Default: 5 min. */
  @prop({ type: Number, default: 5 * 60 * 1000 })
  public timeoutDurationMs!: number;

  /** Whether to delete spam messages. */
  @prop({ type: Boolean, default: true })
  public deleteMessages!: boolean;

  /** Channels exempt from anti-spam. */
  @prop({ type: () => [String], default: [] })
  public ignoredChannels!: string[];

  /** Roles exempt from anti-spam. */
  @prop({ type: () => [String], default: [] })
  public ignoredRoles!: string[];

  /** Whether to block Discord invite links to other servers. */
  @prop({ type: Boolean, default: false })
  public blockInviteLinks!: boolean;

  /** Whether to block mass mentions (@everyone, @here, many @user). */
  @prop({ type: Boolean, default: false })
  public blockMassMentions!: boolean;

  /** Max user mentions allowed per message (exceeded → block). Default: 5. */
  @prop({ type: Number, default: 5 })
  public maxMentionsPerMessage!: number;

  /** Whether to block @everyone / @here mentions. */
  @prop({ type: Boolean, default: true })
  public blockEveryoneHere!: boolean;

  /** Whether to detect duplicate/flood messages (same text repeated across channels). */
  @prop({ type: Boolean, default: false })
  public blockFlood!: boolean;

  /** Number of duplicate messages within the flood window that triggers detection. */
  @prop({ type: Number, default: 3 })
  public floodThreshold!: number;

  /** Flood time window in milliseconds. Default: 30s. */
  @prop({ type: Number, default: 30_000 })
  public floodWindowMs!: number;
}

export const AntiSpamConfigModel = getModelForClass(AntiSpamConfig);
